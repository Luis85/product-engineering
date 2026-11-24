import { Context, Effect, Layer, Schema, Semaphore, Stream } from "effect";
import { nfrIdSchema, nfrType } from "../../../domain/backlog";
import type { NfrDraft, NfrId, NfrTarget } from "../../../domain/backlog";
import { parseSchemaMarker, recordFileName } from "../../../domain/notes";
import type { Frontmatter } from "../../../domain/notes";
import {
  IdGenerator,
  isInFolder,
  noteChanges,
  noteSnapshot,
  NoteStore,
  recordFrontmatter,
} from "../../notes";
import type { Note } from "../../notes";
import { projectMembers, readFreshProject } from "../../projects";
import type { Project, ProjectId } from "../../projects";
import { NfrError } from "./model";
import type { NfrRecord, NfrSnapshot } from "./model";

const isNfrId = Schema.is(nfrIdSchema);
type DecodedNfr = Exclude<
  ReturnType<typeof nfrType.decode<Frontmatter>>,
  { kind: "not-this-type" }
>;
const nfrFolder = (project: Project) => (project.folder ? project.folder + "/NFRs" : "NFRs");

class NfrWrites extends Context.Service<NfrWrites, Semaphore.Semaphore>()(
  "product-engineering/application/NfrWrites",
) {}
export const nfrWritesLayer = Layer.effect(NfrWrites, Semaphore.make(1));
export const withNfrWrite = <A, E, R>(write: Effect.Effect<A, E, R>) =>
  NfrWrites.use((lock) => lock.withPermit(Effect.uninterruptible(write)));

function nfrRecord(note: DecodedNfr, projectId: ProjectId, id: NfrId): NfrRecord | undefined {
  if (note.kind !== "editable" || note.issues.length) return;
  const { title, requirement, acceptance, owner_id, categories, targets } = note.values;
  if (title === undefined || requirement === undefined || acceptance === undefined) return;
  return {
    id,
    path: note.path,
    frontmatter: note.frontmatter,
    projectId,
    title,
    requirement,
    acceptance,
    owner_id,
    categories: categories ?? [],
    targets: targets ?? [],
  };
}

type IndexedNfr = {
  readonly ready: boolean;
  readonly failure: unknown;
  readonly notes: readonly DecodedNfr[];
};

function ownedEntries(project: ProjectId, notes: readonly DecodedNfr[]) {
  const records: NfrRecord[] = [];
  const invalid: NfrSnapshot["invalid"][number][] = [];
  const seen = countIds(notes);
  for (const note of notes.filter(({ frontmatter }) => frontmatter.project_id === project)) {
    const id = isNfrId(note.id) ? note.id : undefined;
    const record = id && seen.get(id) === 1 ? nfrRecord(note, project, id) : undefined;
    if (record) records.push(record);
    else invalid.push({ path: note.path, label: note.values.title ?? note.path, id });
  }
  return { records, invalid };
}

function countIds(notes: readonly DecodedNfr[]) {
  const seen = new Map<string, number>();
  for (const { id } of notes) if (id) seen.set(id, (seen.get(id) ?? 0) + 1);
  return seen;
}

function catalog(project: ProjectId, { ready, failure, notes }: IndexedNfr): NfrSnapshot {
  const { records, invalid } = ownedEntries(project, notes);
  return {
    ready,
    failed: failure !== undefined,
    records: records.toSorted((a, b) => a.title.localeCompare(b.title) || a.id.localeCompare(b.id)),
    invalid,
  };
}

export const nfrSnapshot = (project: ProjectId) =>
  Effect.map(noteSnapshot(nfrType), (source) => catalog(project, source));

export const nfrChanges = (project: ProjectId) =>
  Stream.map(noteChanges(nfrType), (source) => catalog(project, source));

function candidate(note: Note, folder: string) {
  const marker = parseSchemaMarker(note.frontmatter.schema);
  return (
    (marker._tag === "record" && marker.type === nfrType.type) ||
    isNfrId(note.frontmatter.id) ||
    isInFolder(note.path, folder)
  );
}

export function writableNfrCatalog(projectId: ProjectId) {
  return Effect.gen(function* () {
    const project = yield* readFreshProject(projectId);
    if (!project) return yield* new NfrError({ reason: "scope" });
    const store = yield* NoteStore;
    const sources = (yield* store.sources).filter((note) => candidate(note, nfrFolder(project)));
    const latest = yield* Effect.forEach(
      sources,
      ({ path }) =>
        store
          .readFresh(path)
          .pipe(Effect.catchTag("NoteNotFoundError", () => Effect.succeed(undefined))),
      { concurrency: 4 },
    );
    const decoded = latest.flatMap((note) => {
      if (!note) return [];
      const record = nfrType.decode(note);
      return record.kind === "not-this-type" ? [] : [record];
    });
    return {
      project,
      store,
      decoded,
      members: projectMembers(project) ?? [],
      ...catalog(projectId, { ready: true, failure: undefined, notes: decoded }),
    };
  });
}

export const newNfrId = IdGenerator.use(({ nextId }) =>
  Effect.map(nextId, (uuid): NfrId => `nfr-${uuid.toLowerCase()}`),
);

export function createNfrNote(
  store: NoteStore["Service"],
  project: Project,
  id: NfrId,
  draft: NfrDraft,
  targets: readonly NfrTarget[] = [],
) {
  return store.create({
    folder: nfrFolder(project),
    name: `${recordFileName(draft.title, "NFR")} ${id}`,
    frontmatter: recordFrontmatter(nfrType, id, { ...draft, project_id: project.id, targets }),
  });
}
