import { Effect, Stream } from "effect";
import { isPrototypeId, isPrototypeSource, prototypeType } from "../../domain/prototypes";
import type { PrototypeSource } from "../../domain/prototypes";
import type { NoteValues } from "../../domain/notes";
import { noteChanges, noteSnapshot } from "../notes";
import type { Note } from "../notes";
import type { ProjectId } from "../projects";

type Decoded = ReturnType<typeof prototypeType.decode<Note["frontmatter"]>>;
type PrototypeValues = NoteValues<typeof prototypeType.fields>;

function coreFields(values: PrototypeValues) {
  const { project_id: projectId, title, display_id: displayId } = values;
  const revision = values.revision ?? values.rev;
  if (!projectId || !title || !displayId || !revision) return;
  return { projectId, title, displayId, revision };
}

function sourceFields(values: PrototypeValues, projectId: ProjectId) {
  const { source_kind: kind, source_id: id, source_project_id: sourceProject } = values;
  return [kind, id, sourceProject].some((part) => part !== undefined)
    ? { kind, id, projectId: sourceProject }
    : { kind: "UC", id: values.uc, projectId };
}

function prototypeRecord(note: Decoded) {
  if (note.kind !== "editable" || note.issues.length || !isPrototypeId(note.id)) return;
  const values = note.values;
  const core = coreFields(values);
  if (!core) return;
  const source = sourceFields(values, core.projectId);
  return {
    id: note.id,
    path: note.path,
    frontmatter: note.frontmatter,
    ...core,
    description: values.description ?? "",
    source: isPrototypeSource(source) ? source : undefined,
    sourceId: source.id,
    values,
  };
}

export type PrototypeRecord = NonNullable<ReturnType<typeof prototypeRecord>>;
export const decodePrototype = (note: Note) => prototypeRecord(prototypeType.decode(note));

function catalog(
  project: ProjectId,
  source: {
    readonly notes: readonly Decoded[];
    readonly ready: boolean;
    readonly failure: unknown;
  },
) {
  const records = source.notes
    .flatMap((note) => {
      const record = prototypeRecord(note);
      return record?.projectId === project ? [record] : [];
    })
    .toSorted((a, b) => a.displayId.localeCompare(b.displayId, undefined, { numeric: true }));
  return { ready: source.ready, failed: source.failure !== undefined, records };
}

export const prototypesSnapshot = (project: ProjectId) =>
  Effect.map(noteSnapshot(prototypeType), (source) => catalog(project, source));
export const prototypesChanges = (project: ProjectId) =>
  Stream.map(noteChanges(prototypeType), (source) => catalog(project, source));

export function prototypesForSource(records: readonly PrototypeRecord[], source: PrototypeSource) {
  return records.filter(
    (record) =>
      record.projectId === source.projectId &&
      record.source?.projectId === source.projectId &&
      record.source.kind === source.kind &&
      record.source.id === source.id,
  );
}

export function prototypeOutputStatus({ values, revision }: PrototypeRecord) {
  if (!values.output_html && !(values.uc && values.label)) return "brief";
  const outputRevision = values.output_revision ?? values.rev ?? revision;
  return outputRevision === revision ? "recorded" : "stale";
}
