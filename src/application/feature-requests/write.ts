import { Context, Effect, Layer, Result, Semaphore } from "effect";
import {
  featureRequestType,
  invalidRequestField,
  isFeatureRequestId,
  isRequestPbiId,
  normalizeRequestScope,
} from "../../domain/feature-requests";
import type { FeatureRequestId } from "../../domain/feature-requests";
import { parseSchemaMarker, recordId, sameFrontmatter } from "../../domain/notes";
import type { Frontmatter } from "../../domain/notes";
import { readPbiDetail } from "../backlog";
import { IdGenerator, NoteStore, recordFolder, recordFrontmatter } from "../notes";
import type { Note } from "../notes";
import { readFreshProject } from "../projects";
import type { ProjectId, ProjectSettings } from "../projects";
import { FeatureRequestError } from "./errors";
import { decodeFeatureRequest, featureRequestsForPbi } from "./records";
import type { FeatureRequest } from "./records";

class FeatureRequestWrites extends Context.Service<
  FeatureRequestWrites,
  { readonly lock: Semaphore.Semaphore; readonly recent: Set<string> }
>()("product-engineering/application/FeatureRequestWrites") {}

export const featureRequestWritesLayer = Layer.effect(
  FeatureRequestWrites,
  Effect.map(Semaphore.make(1), (lock) => ({ lock, recent: new Set() })),
);

export const newFeatureRequestId = IdGenerator.use(({ nextId }) =>
  Effect.map(nextId, (uuid) => {
    const id = recordId(featureRequestType.type, uuid);
    if (!isFeatureRequestId(id))
      throw new Error("The host generated an invalid Feature Request ID");
    return id;
  }),
);

export type FeatureRequestDraft = {
  readonly pbiId: string;
  readonly title: string;
  readonly scope: string;
};

function requestSource({ frontmatter }: Note) {
  const marker = parseSchemaMarker(frontmatter.schema);
  return (
    isFeatureRequestId(frontmatter.id) ||
    (marker._tag === "record" && marker.type === featureRequestType.type)
  );
}

function freshRequests(store: NoteStore["Service"], recent: Set<string>) {
  return Effect.gen(function* () {
    const paths = new Set((yield* store.sources).filter(requestSource).map(({ path }) => path));
    for (const path of recent) {
      if (paths.has(path)) recent.delete(path);
      else paths.add(path);
    }
    const notes = yield* Effect.forEach(
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
    );
    return notes.filter((note) => note !== undefined);
  });
}

function recordsIn(projectId: ProjectId, notes: readonly Note[]) {
  return notes.flatMap((note) => {
    const record = decodeFeatureRequest(note);
    return record?.projectId === projectId ? [record] : [];
  });
}

function readActive(projectId: ProjectId, pbiId: string, records: readonly FeatureRequest[]) {
  return featureRequestsForPbi(projectId, pbiId, records).active?.id;
}

export const activeFeatureRequest = (projectId: ProjectId, pbiId: string) =>
  FeatureRequestWrites.use(({ lock, recent }) =>
    lock.withPermit(
      Effect.gen(function* () {
        const store = yield* NoteStore;
        return readActive(
          projectId,
          pbiId,
          recordsIn(projectId, yield* freshRequests(store, recent)),
        );
      }),
    ),
  );

function nextSequence(projectId: ProjectId, notes: readonly Note[]) {
  const max = notes.reduce((latest, { frontmatter }) => {
    if (frontmatter.project_id !== projectId) return latest;
    const displayId = frontmatter.display_id;
    const display =
      typeof displayId === "string" && /^FR-\d+$/.test(displayId) ? Number(displayId.slice(3)) : 0;
    const sequence = typeof frontmatter.sequence === "number" ? frontmatter.sequence : 0;
    return Math.max(latest, display, sequence);
  }, 0);
  return max + 1;
}

function validSource(projectId: ProjectId, pbiId: string) {
  return Effect.gen(function* () {
    if (!isRequestPbiId(pbiId)) return yield* new FeatureRequestError({ reason: "pbi" });
    const result = yield* Effect.result(readPbiDetail(projectId, pbiId));
    if (Result.isFailure(result)) return yield* new FeatureRequestError({ reason: "pbi" });
    return result.success;
  });
}

function normalizedDraft(draft: FeatureRequestDraft) {
  const title = draft.title.trim();
  const scope = normalizeRequestScope(draft.scope);
  if (title && invalidRequestField("title", title))
    return Effect.fail(new FeatureRequestError({ reason: "title" }));
  if (invalidRequestField("scope", scope))
    return Effect.fail(new FeatureRequestError({ reason: "scope" }));
  return Effect.succeed({ pbiId: draft.pbiId, title, scope });
}

function repeatedCommand(
  notes: readonly Note[],
  id: FeatureRequestId,
  projectId: ProjectId,
  { pbiId, title, scope }: FeatureRequestDraft,
) {
  const matching = notes.filter(({ frontmatter }) => frontmatter.id === id);
  const note = matching[0];
  if (!note) return Effect.succeed(undefined);
  const current = decodeFeatureRequest(note);
  if (
    matching.length !== 1 ||
    current?.projectId !== projectId ||
    current.pbiId !== pbiId ||
    current.scope !== scope ||
    (title && current.title !== title)
  )
    return Effect.fail(new FeatureRequestError({ reason: "identity" }));
  return Effect.succeed(id);
}

function persistDraft(
  store: NoteStore["Service"],
  project: ProjectSettings,
  id: FeatureRequestId,
  draft: FeatureRequestDraft,
  sequence: number,
) {
  return Effect.gen(function* () {
    const source = yield* validSource(project.id, draft.pbiId);
    const title = draft.title || source.edit.item.title;
    if (invalidRequestField("title", title))
      return yield* new FeatureRequestError({ reason: "title" });
    if (!Number.isSafeInteger(sequence))
      return yield* new FeatureRequestError({ reason: "identity" });
    const displayId = "FR-" + String(sequence).padStart(3, "0");
    return yield* store.create({
      folder: recordFolder(project.folder, featureRequestType),
      name: `${displayId} ${id}`,
      frontmatter: recordFrontmatter(featureRequestType, id, {
        project_id: project.id,
        pbi_id: draft.pbiId,
        display_id: displayId,
        title,
        scope: draft.scope,
        sequence,
        revision: 1,
        state: "draft",
      }),
    });
  });
}

export function createFeatureRequest(
  projectId: ProjectId,
  id: FeatureRequestId,
  draft: FeatureRequestDraft,
  contextual = false,
) {
  return FeatureRequestWrites.use(({ lock, recent }) =>
    lock.withPermit(
      Effect.uninterruptible(
        Effect.gen(function* () {
          if (!isFeatureRequestId(id))
            return yield* new FeatureRequestError({ reason: "identity" });
          const project = yield* readFreshProject(projectId);
          if (!project) return yield* new FeatureRequestError({ reason: "project" });
          const value = yield* normalizedDraft(draft);
          const store = yield* NoteStore;
          const notes = yield* freshRequests(store, recent);
          const existing = yield* repeatedCommand(notes, id, projectId, value);
          if (existing) return existing;
          const records = recordsIn(projectId, notes);
          const applicable = contextual
            ? records
            : records.filter((record) => normalizeRequestScope(record.scope) === value.scope);
          const active = readActive(projectId, value.pbiId, applicable);
          if (active) return active;
          const created = yield* persistDraft(
            store,
            project,
            id,
            value,
            nextSequence(projectId, notes),
          );
          recent.add(created.path);
          return id;
        }),
      ),
    ),
  );
}

type RequestIdentity = Pick<FeatureRequest, "projectId" | "id">;

function uniqueRequest(identity: RequestIdentity, notes: readonly Note[]) {
  const matches = notes.filter(({ frontmatter }) => frontmatter.id === identity.id);
  const note = matches[0];
  const record = note && decodeFeatureRequest(note);
  if (matches.length !== 1 || !record || record.projectId !== identity.projectId) return;
  return { note, record };
}

export const freshFeatureRequest = (identity: RequestIdentity) =>
  FeatureRequestWrites.use(({ recent }) =>
    NoteStore.use((store) =>
      Effect.map(freshRequests(store, recent), (notes) => uniqueRequest(identity, notes)?.record),
    ),
  );

function requestChange(store: NoteStore["Service"], note: Note, values: Frontmatter) {
  const fields = Object.entries(values);
  const set = Object.fromEntries(fields.filter(([, value]) => value !== undefined));
  const remove = fields.flatMap(([key, value]) => (value === undefined ? [key] : []));
  return store.update(note.path, (current) =>
    sameFrontmatter(current, note.frontmatter)
      ? Result.succeed({ set, remove })
      : Result.fail(new FeatureRequestError({ reason: "conflict" })),
  );
}

export function changeFeatureRequest<A, E, R>(
  expected: RequestIdentity,
  change: (
    current: FeatureRequest,
    persist: (set: Frontmatter) => ReturnType<typeof requestChange>,
  ) => Effect.Effect<A, E, R>,
) {
  return FeatureRequestWrites.use(({ lock, recent }) =>
    lock.withPermit(
      Effect.uninterruptible(
        Effect.gen(function* () {
          const store = yield* NoteStore;
          const found = uniqueRequest(expected, yield* freshRequests(store, recent));
          if (!found) return yield* new FeatureRequestError({ reason: "identity" });
          return yield* change(found.record, (set) => requestChange(store, found.note, set));
        }),
      ),
    ),
  );
}
