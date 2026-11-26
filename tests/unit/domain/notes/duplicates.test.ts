import { expect, it } from "vitest";
import { markDuplicateIds, schemaMarker } from "../../../../src/domain/notes";
import { TEST_RECORD_ID, testNoteType } from "../../../support/notes/test-note-type";

const schema = schemaMarker(testNoteType.type, testNoteType.version);
const frontmatter = { schema, id: TEST_RECORD_ID, title: "Record" };

it("marks every duplicate with the first other path while preserving valid field values", () => {
  const initial = [
    testNoteType.decode({ path: "First.md", frontmatter }),
    testNoteType.decode({ path: "Second.md", frontmatter: { ...frontmatter, title: "Copy" } }),
    testNoteType.decode({
      path: "Newer.md",
      frontmatter: { ...frontmatter, schema: schemaMarker(testNoteType.type, 4) },
    }),
    testNoteType.decode({
      path: "Other.md",
      frontmatter: { ...frontmatter, schema: "product-engineering.other/v1" },
    }),
  ] as const;

  const notes = markDuplicateIds(initial);
  expect(notes.slice(0, 3)).toMatchObject([
    {
      kind: "read-only",
      id: TEST_RECORD_ID,
      issue: { code: "id.duplicate", other: "Second.md" },
      values: { title: "Record" },
    },
    {
      kind: "read-only",
      id: TEST_RECORD_ID,
      issue: { code: "id.duplicate", other: "First.md" },
      values: { title: "Copy" },
    },
    {
      kind: "read-only",
      id: TEST_RECORD_ID,
      issue: { code: "id.duplicate", other: "First.md" },
      values: {},
    },
  ]);
  expect(notes[3]).toBe(initial[3]);
  expect(notes[0]).not.toHaveProperty("issues");
  expect(initial[0].kind).toBe("editable");
});

it("keeps unrelated entries untouched and ignores duplicate listings of the same path", () => {
  const note = testNoteType.decode({ path: "Record.md", frontmatter });
  const broken = testNoteType.decode({
    path: "Broken.md",
    frontmatter: { ...frontmatter, id: null },
  });
  const notes = markDuplicateIds([note, note, broken]);

  expect(notes[0]).toBe(note);
  expect(notes[1]).toBe(note);
  expect(notes[2]).toBe(broken);
});
