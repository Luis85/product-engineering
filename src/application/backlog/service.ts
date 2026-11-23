import { Context, Effect, Layer, Result, Semaphore, Stream } from "effect";
import { backlogType } from "../../domain/backlog";
import type { BacklogKind } from "../../domain/backlog";
import { recordId, sameFrontmatterValue, schemaMarker } from "../../domain/notes";
import type { Frontmatter, FrontmatterPatch } from "../../domain/notes";
import { IdGenerator, NoteIndex, NoteStore } from "../notes";
import type { Note } from "../notes";
import { ProjectFiles, projectChanges, projectSnapshot } from "../projects";
import type { BacklogBase, Project, ProjectId } from "../projects";
import { EventBus } from "../shell";
import { BacklogError, backlogItems, inBacklog } from "./model";
import type { BacklogItem, BacklogSnapshot } from "./model";

export type BacklogIdentity = { readonly id: string; readonly record: string };
export type BacklogContext = {
  readonly project: Project;
  readonly base: BacklogBase;
  readonly others: readonly Project[];
};
type BacklogUndo = {
  readonly key: string;
  readonly before: Frontmatter;
  readonly after: Frontmatter;
  readonly keys: readonly string[];
};

type BacklogWriteState = {
  readonly lock: Semaphore.Semaphore;
  readonly recent: Map<string, Note>;
  readonly undo: Map<ProjectId, BacklogUndo>;
};

export class BacklogWrites extends Context.Service<BacklogWrites, BacklogWriteState>()(
  "product-engineering/application/BacklogWrites",
) {}

export const backlogWritesLayer = Layer.effect(
  BacklogWrites,
  Effect.map(Semaphore.make(1), (lock) => ({
    lock,
    recent: new Map(),
    undo: new Map(),
  })),
);

const backlogProject = (id: ProjectId) =>
  Effect.gen(function* () {
    const { projects } = yield* projectSnapshot;
    const project = projects.find((entry) => entry.id === id);
    if (!project) return yield* new BacklogError({ reason: "scope" });
    return { project, projects };
  });

export const scopedBacklog = (id: ProjectId) =>
  Effect.gen(function* () {
    const { project, projects } = yield* backlogProject(id);
    const files = yield* ProjectFiles;
    const base = yield* files.readBacklog(project.backlogBasePath, id);
    if (!base) return yield* new BacklogError({ reason: "base" });
    return { project, base, others: projects } satisfies BacklogContext;
  });

export const openBacklogBase = (id: ProjectId) =>
  Effect.gen(function* () {
    const { project } = yield* backlogProject(id);
    const files = yield* ProjectFiles;
    yield* files.openBacklog(project.backlogBasePath);
  });

export const backlogSnapshot = (project: ProjectId) =>
  Effect.gen(function* (): Effect.fn.Return<BacklogSnapshot, never, NoteIndex | ProjectFiles> {
    const index = yield* NoteIndex;
    const { ready, failure, notes } = yield* index.sourceSnapshot;
    if (!ready || failure)
      return { ready, items: [], duplicates: [], ...(failure && { issue: "index" as const }) };
    const context = yield* Effect.result(scopedBacklog(project));
    if (Result.isFailure(context)) {
      const issue =
        context.failure._tag === "BacklogError" && context.failure.reason === "scope"
          ? "scope"
          : "base";
      return { ready, items: [], duplicates: [], issue };
    }
    const { project: current, base, others } = context.success;
    return { ready, base, ...backlogItems(current, base, notes, others) };
  });

export const backlogInputs = Stream.unwrap(
  Effect.gen(function* () {
    const index = yield* NoteIndex;
    const events = yield* EventBus;
    const bases = Stream.filter(
      yield* events.subscribe,
      (event) => "extension" in event && event.extension === "base",
    );
    return Stream.merge(Stream.merge(index.sourceChanges, projectChanges), bases);
  }),
);

export const backlogChanges = (project: ProjectId) =>
  backlogInputs.pipe(Stream.mapEffect(() => backlogSnapshot(project)));

export function newBacklogIdentity(kind: BacklogKind) {
  return IdGenerator.use(({ nextId }) =>
    Effect.map(nextId, (uuid): BacklogIdentity => ({
      id: kind + "-" + uuid.toLowerCase(),
      record: recordId(backlogType.type, uuid),
    })),
  );
}

export function identityFields(project: ProjectId, id: BacklogIdentity): Frontmatter {
  return {
    schema: schemaMarker(backlogType.type, backlogType.version),
    id: id.record,
    project_id: project,
    "pe-id": id.id,
  };
}

export const writableItems = (context: BacklogContext) =>
  Effect.gen(function* () {
    const store = yield* NoteStore;
    const writes = yield* BacklogWrites;
    const sources = new Map((yield* store.sources).map((note) => [note.path, note]));
    for (const [path] of writes.recent) {
      const read = yield* Effect.catchTag(store.readFresh(path), "NoteNotFoundError", () =>
        Effect.succeed(undefined),
      );
      if (read) {
        const cached = sources.get(path);
        if (cached && sameFrontmatterValue(cached.frontmatter, read.frontmatter))
          writes.recent.delete(path);
        sources.set(path, read);
      } else writes.recent.delete(path);
    }
    return backlogItems(context.project, context.base, [...sources.values()], context.others);
  });

export const writableRow = (context: BacklogContext, key: string) =>
  Effect.gen(function* () {
    const { items, duplicates } = yield* writableItems(context);
    if (duplicates.includes(key)) return yield* new BacklogError({ reason: "duplicate" });
    const row = items.find((item) => key === item.key || key === item.path);
    if (!row) return yield* new BacklogError({ reason: "missing" });
    if (row.conflict)
      return yield* new BacklogError({
        reason: row.id && duplicates.includes(row.id) ? "duplicate" : "identity",
      });
    return { row, items };
  });

export function frontmatterPatch(fields: Frontmatter): FrontmatterPatch {
  const entries = Object.entries(fields);
  return {
    set: Object.fromEntries(entries.filter(([, value]) => value !== undefined)),
    remove: entries.filter(([, value]) => value === undefined).map(([key]) => key),
  };
}

export function matchesFields(current: Frontmatter, before: Frontmatter, after: Frontmatter) {
  return Object.keys(after).every(
    (key) =>
      sameFrontmatterValue(current[key], before[key]) ||
      sameFrontmatterValue(current[key], after[key]),
  );
}

export function stillInBacklog(context: BacklogContext, row: BacklogItem, current: Frontmatter) {
  return (
    inBacklog(
      { path: row.path, frontmatter: current },
      context.project,
      context.base,
      context.others,
    ) &&
    ["type", "pe-id", "schema", "id", "project_id"].every((key) =>
      sameFrontmatterValue(current[key], row.fields[key]),
    )
  );
}

export function adoptBacklogItem(project: ProjectId, key: string) {
  return BacklogWrites.use(({ lock, recent }) =>
    lock.withPermit(
      Effect.gen(function* () {
        const context = yield* scopedBacklog(project);
        const { row, items } = yield* writableRow(context, key);
        if (row.adopted) return row;
        const generated = yield* newBacklogIdentity(row.kind);
        const identity = { ...generated, id: row.id ?? generated.id };
        if (items.some((item) => item.path !== row.path && item.id === identity.id))
          return yield* new BacklogError({ reason: "duplicate" });
        const store = yield* NoteStore;
        const note = yield* store.update(row.path, (current) =>
          stillInBacklog(context, row, current)
            ? Result.succeed({ set: identityFields(project, identity) })
            : Result.fail(new BacklogError({ reason: "conflict" })),
        );
        recent.set(note.path, note);
        return {
          ...row,
          key: identity.id,
          id: identity.id,
          adopted: true,
          fields: note.frontmatter,
        };
      }),
    ),
  );
}
