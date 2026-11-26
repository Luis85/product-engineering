import type {
  Frontmatter,
  NoteFieldCode,
  NoteFields,
  NoteIssue,
  NoteKey,
  NoteValues,
} from "../../domain/notes";
import type { IndexedNote, NoteIndexSnapshot } from "./note-index";

type CodecIssue<Fields extends NoteFields> = NoteIssue<NoteKey<Fields>, NoteFieldCode<Fields>>;

export interface RecordRow<
  Fields extends NoteFields = NoteFields,
  Issue extends NoteIssue = never,
> {
  readonly path: string;
  readonly fileName: string;
  readonly id: string | undefined;
  readonly editable: boolean;
  readonly values: NoteValues<Fields>;
  readonly issues: readonly (CodecIssue<Fields> | Issue)[];
  readonly frontmatter: Frontmatter;
}

export interface RecordList<
  Fields extends NoteFields = NoteFields,
  Issue extends NoteIssue = never,
> {
  readonly ready: boolean;
  readonly failure: NoteIndexSnapshot<never>["failure"];
  readonly rows: readonly RecordRow<Fields, Issue>[];
}

export interface RecordListOptions<Fields extends NoteFields, Issue extends NoteIssue = never> {
  readonly title: (values: NoteValues<Fields>) => string | undefined;
  readonly collation: string;
  readonly issue?: (issue: CodecIssue<Fields>, note: IndexedNote<Fields>) => Issue;
  readonly between?: (
    rows: readonly RecordRow<Fields, Issue>[],
  ) => readonly RecordRow<Fields, Issue>[];
}

export function fileNameOf(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1).replace(/\.md$/i, "");
}

export function shownRecordName<Values>(
  row: { readonly values: Values; readonly fileName: string },
  title: (values: Values) => string | undefined,
): string {
  return title(row.values) || row.fileName;
}

function asRow<Fields extends NoteFields, Issue extends NoteIssue>(
  note: IndexedNote<Fields>,
  issue: RecordListOptions<Fields, Issue>["issue"],
): RecordRow<Fields, Issue> {
  const issues = note.kind === "editable" ? note.issues : [note.issue];
  return {
    path: note.path,
    fileName: fileNameOf(note.path),
    id: note.id,
    editable: note.kind === "editable",
    values: note.values,
    issues: issue ? issues.map((problem) => issue(problem, note)) : issues,
    frontmatter: note.frontmatter,
  };
}

function comparePaths(left: string, right: string): number {
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

export function toRecordList<Fields extends NoteFields, Issue extends NoteIssue = never>(
  snapshot: NoteIndexSnapshot<IndexedNote<Fields>>,
  options: RecordListOptions<Fields, Issue>,
): RecordList<Fields, Issue> {
  const { title, collation, issue, between } = options;
  const rows = snapshot.notes
    .map((note) => asRow(note, issue))
    .toSorted(
      (left, right) =>
        shownRecordName(left, title).localeCompare(shownRecordName(right, title), collation, {
          numeric: true,
        }) || comparePaths(left.path, right.path),
    );
  return {
    ready: snapshot.ready,
    failure: snapshot.failure,
    rows: between ? between(rows) : rows,
  };
}
