import { Context, Effect, Layer, Result, Semaphore } from "effect";
import { recordId, sameFrontmatterValue } from "../../domain/notes";
import type { Frontmatter, FrontmatterPatch } from "../../domain/notes";
import {
  invalidPrototypeBriefField,
  isPrototypeId,
  prototypeBriefFields,
  prototypeType,
} from "../../domain/prototypes";
import type { PrototypeId, PrototypeSource } from "../../domain/prototypes";
import { editChange, IdGenerator, NoteStore, recordFolder, recordFrontmatter } from "../notes";
import type { Note, NoteEditConflictError, NoteWriteRefusedError } from "../notes";
import { readFreshProject } from "../projects";
import type { ProjectId, ProjectSettings } from "../projects";
import { prototypeDesignValues, savePrototypeDesigns, validatePrototypeDesigns } from "./design";
import type { PrototypeDesigns } from "./design";
import { PrototypeError } from "./errors";
import { decodePrototype } from "./records";
import type { PrototypeRecord } from "./records";
import { resolvePrototypeSource } from "./sources";

class PrototypeWrites extends Context.Service<
  PrototypeWrites,
  {
    readonly lock: Semaphore.Semaphore;
    readonly recent: Set<string>;
  }
>()("product-engineering/application/PrototypeWrites") {}

export const prototypeWritesLayer = Layer.effect(
  PrototypeWrites,
  Effect.map(Semaphore.make(1), (lock) => ({ lock, recent: new Set() })),
);

export const newPrototypeId = IdGenerator.use(({ nextId }) =>
  Effect.map(nextId, (uuid) => {
    const id = recordId(prototypeType.type, uuid);
    if (!isPrototypeId(id)) throw new Error("The host generated an invalid prototype ID");
    return id;
  }),
);

type PrototypeDraft = {
  readonly title: string;
  readonly description: string;
  readonly source: PrototypeSource;
  readonly designs: PrototypeDesigns;
};

function briefValues(draft: PrototypeDraft) {
  return {
    title: draft.title.trim(),
    description: draft.description.trim(),
    source_kind: draft.source.kind,
    source_project_id: draft.source.projectId,
    source_id: draft.source.id,
    ...prototypeDesignValues(draft.designs),
  };
}

function identical(values: Frontmatter, note: Note) {
  return Object.entries(values).every(([key, value]) =>
    sameFrontmatterValue(value, note.frontmatter[key]),
  );
}

function patchedFields(current: Frontmatter, patch: FrontmatterPatch) {
  return {
    ...current,
    ...Object.fromEntries((patch.remove ?? []).map((key) => [key, undefined])),
    ...patch.set,
  };
}

function nextDisplayId(projectId: ProjectId, notes: readonly Note[]) {
  const latest = notes.reduce((max, { frontmatter }) => {
    const raw = frontmatter.display_id;
    if (
      frontmatter.project_id !== projectId ||
      typeof raw !== "string" ||
      !/^PT-[0-9]{2,}$/.test(raw)
    )
      return max;
    const value = Number(raw.slice(3));
    return Number.isSafeInteger(value + 1) ? Math.max(value, max) : max;
  }, 0);
  return `PT-${String(latest + 1).padStart(2, "0")}`;
}

function freshPrototypes(store: NoteStore["Service"], notes: readonly Note[], recent: Set<string>) {
  const paths = new Set(
    notes
      .filter(
        ({ frontmatter, path }) =>
          isPrototypeId(frontmatter.id) || /(?:^|\/)Prototypes\//.test(path),
      )
      .map(({ path }) => path),
  );
  for (const path of recent) {
    if (paths.has(path)) recent.delete(path);
    else paths.add(path);
  }
  return Effect.map(
    Effect.forEach(
      paths,
      (path) =>
        store
          .readFresh(path)
          .pipe(
            Effect.catchTag(["NoteNotFoundError", "NoteUnreadableError"], () =>
              Effect.succeed(undefined),
            ),
          ),
      { concurrency: 4 },
    ),
    (results) => results.filter((note) => note !== undefined),
  );
}

function editPrototype(base: PrototypeRecord, current: PrototypeRecord, values: Frontmatter) {
  const edited = { ...base.frontmatter, ...values };
  const merge = editChange(prototypeType, base.frontmatter, edited);
  return (
    actual: Frontmatter,
  ): Result.Result<
    FrontmatterPatch,
    PrototypeError | NoteEditConflictError | NoteWriteRefusedError
  > => {
    const latest = decodePrototype({ path: current.path, frontmatter: actual });
    if (latest?.id !== base.id || latest.projectId !== base.projectId)
      return Result.fail(new PrototypeError({ reason: "identity" }));
    return Result.flatMap(merge(actual), (patch) => validatedPatch(latest, patch, values));
  };
}

function validatedPatch(latest: PrototypeRecord, patch: FrontmatterPatch, values: Frontmatter) {
  const combined = patchedFields(latest.frontmatter, patch);
  const changed = (key: string) => !sameFrontmatterValue(combined[key] ?? undefined, values[key]);
  if (["source_kind", "source_project_id", "source_id"].some(changed))
    return Result.fail(new PrototypeError({ reason: "source" }));
  if (["style_guide_id", "design_system_id"].some(changed))
    return Result.fail(new PrototypeError({ reason: "design" }));
  if (!patch.set && !patch.remove) return Result.succeed(patch);
  if (!Number.isSafeInteger(latest.revision + 1))
    return Result.fail(new PrototypeError({ reason: "identity" }));
  // Capture the output's original revision before advancing the brief revision.
  const outputRevision =
    latest.values.output_revision ?? (latest.values.output_html ? latest.revision : undefined);
  return Result.succeed({
    ...patch,
    set: {
      ...patch.set,
      revision: latest.revision + 1,
      ...(outputRevision && { output_revision: outputRevision }),
    },
  });
}

function requireSource(projectId: ProjectId, source: PrototypeSource) {
  return Effect.gen(function* () {
    if (!(yield* resolvePrototypeSource(projectId, source)))
      return yield* new PrototypeError({ reason: "source" });
  });
}

function prepareEdit(
  store: NoteStore["Service"],
  base: PrototypeRecord,
  current: PrototypeRecord | undefined,
  values: Frontmatter,
) {
  return Effect.gen(function* () {
    if (!current) return yield* new PrototypeError({ reason: "identity" });
    const edit = editPrototype(base, current, values);
    yield* Effect.fromResult(edit(current.frontmatter));
    return () => store.update(current.path, edit);
  });
}

function matchingPrototype(notes: readonly Note[], projectId: ProjectId, id: PrototypeId) {
  return Effect.gen(function* () {
    const matches = notes.filter(({ frontmatter }) => frontmatter.id === id);
    const note = matches[0];
    const current = note && decodePrototype(note);
    if (matches.length > 1 || (note && current?.projectId !== projectId))
      return yield* new PrototypeError({ reason: "identity" });
    return current;
  });
}

function prepareCreate(
  store: NoteStore["Service"],
  project: ProjectSettings,
  id: PrototypeId,
  notes: readonly Note[],
  values: Frontmatter,
  recent: Set<string>,
) {
  return () =>
    Effect.gen(function* () {
      const displayId = nextDisplayId(project.id, notes);
      const created = yield* store.create({
        folder: recordFolder(project.folder, prototypeType),
        name: `${displayId} ${id}`,
        frontmatter: recordFrontmatter(prototypeType, id, {
          ...values,
          project_id: project.id,
          display_id: displayId,
          revision: 1,
        }),
      });
      recent.add(created.path);
      return created;
    });
}

function validateBrief(
  projectId: ProjectId,
  id: PrototypeId,
  draft: PrototypeDraft,
  base?: PrototypeRecord,
) {
  return Effect.gen(function* () {
    if (!isPrototypeId(id) || (base && (base.id !== id || base.projectId !== projectId)))
      return yield* new PrototypeError({ reason: "identity" });
    const field = prototypeBriefFields.find((name) =>
      invalidPrototypeBriefField(name, draft[name]),
    );
    if (field) return yield* new PrototypeError({ reason: field });
    const project = yield* readFreshProject(projectId);
    if (!project) return yield* new PrototypeError({ reason: "project" });
    yield* requireSource(projectId, draft.source);
    return project;
  });
}

export function savePrototype(
  projectId: ProjectId,
  id: PrototypeId,
  draft: PrototypeDraft,
  base?: PrototypeRecord,
) {
  return PrototypeWrites.use(({ lock, recent }) =>
    lock.withPermit(
      Effect.uninterruptible(
        Effect.gen(function* () {
          const project = yield* validateBrief(projectId, id, draft, base);
          const store = yield* NoteStore;
          const sources = yield* store.sources;
          yield* validatePrototypeDesigns(store, sources, projectId, draft.designs);
          const notes = yield* freshPrototypes(store, sources, recent);
          const current = yield* matchingPrototype(notes, projectId, id);
          const values = briefValues(draft);
          if (!base && current) {
            if (identical(values, current)) return id;
            return yield* new PrototypeError({ reason: "identity" });
          }
          const persist = base
            ? yield* prepareEdit(store, base, current, values)
            : prepareCreate(store, project, id, notes, values, recent);
          yield* savePrototypeDesigns(projectId, draft.designs);
          yield* requireSource(projectId, draft.source);
          yield* persist();
          return id;
        }),
      ),
    ),
  );
}
