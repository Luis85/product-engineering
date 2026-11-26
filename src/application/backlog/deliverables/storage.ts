import { Context, Effect, Layer, Schema, Semaphore, Stream } from "effect";
import { deliverableType, isDeliverableId } from "../../../domain/backlog";
import type { DeliverableId, DeliverableValues } from "../../../domain/backlog";
import { parseSchemaMarker, recordId } from "../../../domain/notes";
import type { Frontmatter } from "../../../domain/notes";
import { IdGenerator, noteChanges, noteSnapshot, NoteStore } from "../../notes";
import type { Note } from "../../notes";
import { readFreshProject } from "../../projects";
import type { ProjectId } from "../../projects";

export class DeliverableError extends Schema.TaggedError<DeliverableError>()("DeliverableError", {
  reason: Schema.Literals([
    "scope",
    "missing",
    "identity",
    "fields",
    "owner",
    "template",
    "link",
    "pending",
  ]),
}) {}

export type DeliverableRecord = {
  readonly id: DeliverableId;
  readonly projectId: ProjectId;
  readonly displayId: string;
  readonly path: string;
  readonly frontmatter: Frontmatter;
  readonly values: DeliverableValues & {
    readonly title: string;
    readonly outcome: string;
    readonly status: NonNullable<DeliverableValues["status"]>;
  };
};

class DeliverableWrites extends Context.Service<DeliverableWrites, Semaphore.Semaphore>()(
  "product-engineering/application/DeliverableWrites",
) {}
export const deliverableWritesLayer = Layer.effect(DeliverableWrites, Semaphore.make(1));
export const withDeliverableWrite = <A, E, R>(write: Effect.Effect<A, E, R>) =>
  DeliverableWrites.use((lock) => lock.withPermit(Effect.uninterruptible(write)));

export const newDeliverableId = IdGenerator.use(({ nextId }) =>
  Effect.map(nextId, (uuid) => {
    const id = recordId(deliverableType.type, uuid);
    if (!isDeliverableId(id)) throw new Error("The host generated an invalid deliverable ID");
    return id;
  }),
);

type Decoded = ReturnType<typeof deliverableType.decode<Frontmatter>>;

function recordOf(note: Decoded): DeliverableRecord | undefined {
  if (note.kind !== "editable" || note.issues.length || !isDeliverableId(note.id)) return;
  const { project_id, display_id, title, outcome, status } = note.values;
  if (!project_id || !display_id || !title || !outcome || !status) return;
  return {
    id: note.id,
    projectId: project_id,
    displayId: display_id,
    path: note.path,
    frontmatter: note.frontmatter,
    values: { ...note.values, title, outcome, status },
  };
}

export const decodeDeliverable = (note: Note) => recordOf(deliverableType.decode(note));

function collect(projectId: ProjectId, notes: readonly Decoded[]) {
  return notes
    .flatMap((note) => {
      const record = recordOf(note);
      return record?.projectId === projectId ? [record] : [];
    })
    .toSorted((a, b) => a.displayId.localeCompare(b.displayId, undefined, { numeric: true }));
}

function catalog(
  project: ProjectId,
  source: {
    readonly notes: readonly Decoded[];
    readonly ready: boolean;
    readonly failure: unknown;
  },
) {
  return {
    records: collect(project, source.notes),
    ready: source.ready,
    failed: source.failure !== undefined,
  };
}

export const deliverablesSnapshot = (project: ProjectId) =>
  Effect.map(noteSnapshot(deliverableType), (source) => catalog(project, source));
export const deliverablesChanges = (project: ProjectId) =>
  Stream.map(noteChanges(deliverableType), (source) => catalog(project, source));

function deliverableSource({ path, frontmatter }: Note) {
  const marker = parseSchemaMarker(frontmatter.schema);
  return (
    (marker._tag === "record" && marker.type === deliverableType.type) ||
    isDeliverableId(frontmatter.id) ||
    /(?:^|\/)Deliverables\//.test(path)
  );
}

export function freshDeliverables(store: NoteStore["Service"]) {
  return Effect.gen(function* () {
    const notes = (yield* store.sources).filter(deliverableSource);
    return yield* Effect.forEach(
      notes,
      ({ path }) =>
        store
          .readFresh(path)
          .pipe(
            Effect.catchTag(["NoteNotFoundError", "NoteUnreadableError"], () =>
              Effect.succeed(undefined),
            ),
          ),
      { concurrency: 4 },
    );
  });
}

export function writableDeliverables(projectId: ProjectId) {
  return Effect.gen(function* () {
    const project = yield* readFreshProject(projectId);
    if (!project) return yield* new DeliverableError({ reason: "scope" });
    const store = yield* NoteStore;
    const notes = yield* freshDeliverables(store);
    return { project, store, notes };
  });
}

export function findDeliverable(
  notes: readonly (Note | undefined)[],
  project: ProjectId,
  id: string,
) {
  const matches = notes.filter((note) => note?.frontmatter.id === id);
  const note = matches.length === 1 ? matches[0] : undefined;
  const record = note && decodeDeliverable(note);
  return record?.projectId === project ? record : undefined;
}
