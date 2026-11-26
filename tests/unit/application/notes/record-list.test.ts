import { expect, it } from "vitest";
import { NoteIndexReadError } from "../../../../src/application/notes";
import type { IndexedNote } from "../../../../src/application/notes/note-index";
import {
  fileNameOf,
  shownRecordName,
  toRecordList,
} from "../../../../src/application/notes/record-list";
import { recordId, schemaMarker } from "../../../../src/domain/notes";
import type { Frontmatter, NoteIssue } from "../../../../src/domain/notes";
import { TEST_UUID, testNoteType } from "../../../support/notes/test-note-type";

type Fields = typeof testNoteType.fields;
const title = (values: { readonly title?: string }) => values.title;
const collation = "de";

function record(path: string, properties: Frontmatter): IndexedNote<Fields> {
  const note = testNoteType.decode({
    path,
    frontmatter: {
      schema: schemaMarker(testNoteType.type, testNoteType.version),
      id: recordId(testNoteType.type, TEST_UUID),
      ...properties,
    },
  });
  if (note.kind === "not-this-type") throw new Error("Expected a test record");
  return note;
}

it("uses the Markdown stem as file name and fallback for a missing valid title", () => {
  expect(fileNameOf("Records/Folder/Original.MD")).toBe("Original");
  expect(fileNameOf("Name.md.md")).toBe("Name.md");
  expect(shownRecordName({ values: { title: " " }, fileName: "Stem" }, title)).toBe(" ");
  expect(shownRecordName({ values: { title: "" }, fileName: "Stem" }, title)).toBe("Stem");
  expect(shownRecordName({ values: {}, fileName: "Stem" }, title)).toBe("Stem");
});

it("sorts names with numeric German collation and ties by code-unit path", () => {
  const notes = [
    record("Records/a.md", { title: "Zug 2" }),
    record("Records/Z.md", { title: "Zug 02" }),
    record("Records/A.md", { title: "Zug 10" }),
    record("Records/M.md", { title: "Äpfel" }),
    record("Records/Beeren.md", {}),
  ];
  const result = toRecordList({ ready: true, failure: undefined, notes }, { title, collation });
  expect(result.rows.map(({ path }) => path)).toEqual([
    "Records/M.md",
    "Records/Beeren.md",
    "Records/Z.md",
    "Records/a.md",
    "Records/A.md",
  ]);
});

it("keeps snapshot status, projects readonly issues, and gives between the ordered rows", () => {
  const readOnly = record("Records/Broken.md", { title: "Second", id: "invalid" });
  const editable = record("Records/Valid.md", { title: "First", points: "invalid" });
  const failure = new NoteIndexReadError();
  const projected = toRecordList<Fields, NoteIssue & { readonly source: string }>(
    { ready: true, failure, notes: [readOnly, editable] },
    {
      title,
      collation,
      issue: (issue, note) => ({ ...issue, source: note.path }),
      between: (rows) => {
        expect(rows.map((row) => row.fileName)).toEqual(["Valid", "Broken"]);
        return rows.map((row) => ({
          ...row,
          issues: [...row.issues, { key: "title", code: "title.repeat", source: row.path }],
        }));
      },
    },
  );
  expect(projected.ready).toBe(true);
  expect(projected.failure).toBe(failure);
  expect(projected.rows[0]).toMatchObject({
    editable: true,
    issues: [
      { key: "points", code: "field.number", source: editable.path },
      { key: "title", code: "title.repeat", source: editable.path },
    ],
  });
  expect(projected.rows[1]).toMatchObject({
    editable: false,
    id: undefined,
    issues: [
      { code: "id.malformed", source: readOnly.path },
      { key: "title", code: "title.repeat", source: readOnly.path },
    ],
  });
  expect(projected.rows[1]?.frontmatter).toBe(readOnly.frontmatter);
});
