import { markDuplicateIds, parseSchemaMarker, sameFrontmatter } from "../../domain/notes";
import type { NoteType } from "../../domain/notes";
import type { IndexedNote, UnindexedNote } from "./note-index";
import type { Note } from "./ports";

type RecordEntry = {
  readonly kind: "record";
  readonly raw: Note;
  readonly type: NoteType;
  readonly decoded: IndexedNote;
};
type IssueEntry = {
  readonly kind: "issue";
  readonly raw: Note;
  readonly unindexed: UnindexedNote;
};
type Entry = RecordEntry | IssueEntry;

export type IndexState = {
  readonly types: ReadonlyMap<string, NoteType>;
  readonly entries: ReadonlyMap<string, Entry>;
  readonly unreadable: ReadonlySet<string>;
  readonly published: ReadonlyMap<string, IndexedNote>;
  readonly byType: ReadonlyMap<NoteType, readonly IndexedNote[]>;
  readonly unindexed: readonly UnindexedNote[];
};

export function createIndexState(types: readonly NoteType[]): IndexState {
  const registry = new Map(types.map((definition) => [definition.type, definition]));
  if (registry.size !== types.length) throw new Error("Duplicate type in the note index");
  return {
    types: registry,
    entries: new Map(),
    unreadable: new Set(),
    published: new Map(),
    byType: new Map(types.map((type) => [type, []])),
    unindexed: [],
  };
}

function issueEntry(note: Note, issue: UnindexedNote["issue"]): IssueEntry {
  return { kind: "issue", raw: note, unindexed: { path: note.path, issue } };
}

function readEntry(state: IndexState, note: Note): Entry | undefined {
  const old = state.entries.get(note.path);
  if (old && sameFrontmatter(old.raw.frontmatter, note.frontmatter)) return old;
  const marker = parseSchemaMarker(note.frontmatter.schema);
  if (marker._tag === "none") return;
  if (marker._tag === "malformed") return issueEntry(note, { code: "schema.malformed" });
  const type = state.types.get(marker.type);
  if (!type) return issueEntry(note, { code: "schema.unknown-type", type: marker.type });
  const decoded = type.decode(note);
  return decoded.kind === "not-this-type"
    ? issueEntry(note, { code: "schema.malformed" })
    : { kind: "record", raw: note, type, decoded };
}

function byPath(left: { readonly path: string }, right: { readonly path: string }): number {
  if (left.path < right.path) return -1;
  if (left.path > right.path) return 1;
  return 0;
}

function retainList<A>(last: readonly A[], next: readonly A[]): readonly A[] {
  return last.length === next.length && last.every((value, index) => value === next[index])
    ? last
    : next;
}

function duplicateOf(note: IndexedNote | undefined): string | undefined {
  return note?.kind === "read-only" && note.issue.code === "id.duplicate"
    ? note.issue.other
    : undefined;
}

function retainDuplicate(state: IndexState, entry: RecordEntry, note: IndexedNote): IndexedNote {
  const last = state.published.get(note.path);
  if (!last || state.entries.get(note.path) !== entry) return note;
  const other = duplicateOf(note);
  return other !== undefined && duplicateOf(last) === other ? last : note;
}

function projectRecords(state: IndexState, entries: ReadonlyMap<string, Entry>) {
  const records = [...entries.values()]
    .filter((entry) => entry.kind === "record")
    .toSorted((left, right) => byPath(left.raw, right.raw));
  const published = new Map<string, IndexedNote>();
  const grouped = new Map<NoteType, IndexedNote[]>();
  for (const note of markDuplicateIds(records.map(({ decoded }) => decoded))) {
    const entry = entries.get(note.path);
    if (entry?.kind !== "record") throw new Error("Indexed note has no source record");
    const value = retainDuplicate(state, entry, note);
    published.set(value.path, value);
    const group = grouped.get(entry.type) ?? [];
    group.push(value);
    grouped.set(entry.type, group);
  }

  const byType = new Map(
    [...state.types.values()].map((type) => [
      type,
      retainList(state.byType.get(type) ?? [], grouped.get(type) ?? []),
    ]),
  );
  return { published, byType };
}

function projectUnindexed(
  state: IndexState,
  entries: ReadonlyMap<string, Entry>,
  unreadable: ReadonlySet<string>,
): readonly UnindexedNote[] {
  const last = new Map(state.unindexed.map((note) => [note.path, note]));
  const problems = [...entries.values()].flatMap((entry) =>
    entry.kind === "issue" ? [entry.unindexed] : [],
  );
  for (const path of unreadable) {
    if (entries.has(path)) continue;
    const previous = last.get(path);
    problems.push(
      previous?.issue.code === "frontmatter.unreadable"
        ? previous
        : { path, issue: { code: "frontmatter.unreadable" } },
    );
  }
  return retainList(state.unindexed, problems.toSorted(byPath));
}

function project(
  state: IndexState,
  entries: ReadonlyMap<string, Entry>,
  unreadable: ReadonlySet<string>,
): IndexState {
  return {
    types: state.types,
    entries,
    unreadable,
    ...projectRecords(state, entries),
    unindexed: projectUnindexed(state, entries, unreadable),
  };
}

export function buildIndexState(
  previous: IndexState,
  notes: readonly Note[],
  unreadablePaths: readonly string[],
): IndexState {
  const entries = new Map<string, Entry>();
  for (const note of notes) {
    const entry = readEntry(previous, note);
    if (entry) entries.set(note.path, entry);
  }
  return project(previous, entries, new Set(unreadablePaths));
}

export function updateIndexState(
  previous: IndexState,
  rereads: ReadonlyMap<string, Note | undefined>,
  unreadablePaths?: readonly string[],
): IndexState {
  const entries = new Map(previous.entries);
  const unreadable = new Set(unreadablePaths ?? previous.unreadable);
  for (const [path, note] of rereads) {
    const entry = note && readEntry(previous, note);
    if (entry) entries.set(path, entry);
    else entries.delete(path);
    if (!note || entry) unreadable.delete(path);
  }
  return project(previous, entries, unreadable);
}
