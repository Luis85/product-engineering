import type { DecodedNote, NoteFields, ReadOnlyIssue, ReadOnlyNote } from "./note-type";

type AnyDecodedNote = DecodedNote<NoteFields, unknown>;
type DuplicateNote<Raw> = ReadOnlyNote<NoteFields, Raw> & {
  readonly id: string;
  readonly issue: Extract<ReadOnlyIssue, { code: "id.duplicate" }>;
};

interface FirstPaths {
  readonly first: string;
  second?: string;
}

function sharedPaths(notes: readonly AnyDecodedNote[]) {
  const pathsById = new Map<string, FirstPaths>();
  for (const note of notes) {
    if (note.kind === "not-this-type" || note.id === undefined) continue;
    const paths = pathsById.get(note.id);
    if (paths === undefined) pathsById.set(note.id, { first: note.path });
    else if (paths.first !== note.path) paths.second ??= note.path;
  }
  return pathsById;
}

export function markDuplicateIds<Note extends AnyDecodedNote>(
  notes: readonly Note[],
): readonly (Note | DuplicateNote<Note["frontmatter"]>)[] {
  const pathsById = sharedPaths(notes);
  return notes.map((note) => {
    if (note.kind === "not-this-type" || note.id === undefined) return note;
    const { id, path, frontmatter, version, values } = note;
    const paths = pathsById.get(id);
    const other = paths?.first === path ? paths.second : paths?.first;
    if (other === undefined) return note;
    return {
      kind: "read-only",
      path,
      frontmatter,
      version,
      id,
      values,
      issue: { code: "id.duplicate", other },
    };
  });
}
