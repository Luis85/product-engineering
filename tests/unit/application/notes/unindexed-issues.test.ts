import { expect, it } from "vitest";
import {
  buildIndexState,
  createIndexState,
  updateIndexState,
} from "../../../../src/application/notes/index-state";
import { notesModule, describeUnindexedIssue } from "../../../../src/application/notes";
import { schemaMarker } from "../../../../src/domain/notes";
import { TEST_RECORD_ID, testNoteType } from "../../../support/notes/test-note-type";

const good = {
  path: "Outside/Good.md",
  frontmatter: {
    schema: schemaMarker(testNoteType.type, testNoteType.version),
    id: TEST_RECORD_ID,
    title: "Title",
  },
};
const broken = "Records/Unreadable.md";
const malformed = {
  path: "Outside/Malformed.md",
  frontmatter: { schema: "product-engineering.??" },
};
const unknown = {
  path: "Outside/Unknown.md",
  frontmatter: { schema: "product-engineering.unregistered/v1" },
};

it("keeps malformed and unknown records by path and scopes unreadable entries to the store scan", () => {
  const state = buildIndexState(
    createIndexState([testNoteType]),
    [unknown, good, malformed],
    [broken],
  );
  expect(state.byType.get(testNoteType)).toMatchObject([{ path: good.path, kind: "editable" }]);
  expect(state.unindexed).toEqual([
    { path: malformed.path, issue: { code: "schema.malformed" } },
    { path: unknown.path, issue: { code: "schema.unknown-type", type: "unregistered" } },
    { path: broken, issue: { code: "frontmatter.unreadable" } },
  ]);

  const updated = updateIndexState(
    state,
    new Map([
      [unknown.path, { ...unknown, frontmatter: {} }],
      [broken, undefined],
    ]),
  );
  expect(updated.unindexed).toEqual([state.unindexed[0]]);
  expect(updated.unindexed[0]).toBe(state.unindexed[0]);
  expect(updated.byType.get(testNoteType)).toBe(state.byType.get(testNoteType));
});

it("uses the latest scan for unreadable paths and keeps unaffected snapshot references", () => {
  const state = buildIndexState(createIndexState([testNoteType]), [good], [broken]);
  const rebuilt = buildIndexState(
    state,
    [{ ...good, frontmatter: { ...good.frontmatter } }],
    [broken],
  );
  expect(rebuilt.byType.get(testNoteType)).toBe(state.byType.get(testNoteType));
  expect(rebuilt.unindexed).toBe(state.unindexed);
  const recovered = updateIndexState(rebuilt, new Map(), []);
  expect(recovered.unindexed).toEqual([]);
});

it.each(["en", "de"] as const)("describes unindexed reasons in %s", (language) => {
  const catalog = notesModule.catalog[language];
  const texts = [
    describeUnindexedIssue({ code: "schema.malformed" }, catalog),
    describeUnindexedIssue({ code: "schema.unknown-type", type: "unregistered" }, catalog),
    describeUnindexedIssue({ code: "frontmatter.unreadable" }, catalog),
  ];
  expect(texts.every((description) => description.length > 5)).toBe(true);
  expect(texts[1]).toContain("unregistered");
  expect(new Set(texts).size).toBe(3);
});
