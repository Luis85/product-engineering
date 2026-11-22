import { expect, expectTypeOf, it } from "vitest";
import { defineNoteType, schemaMarker } from "../../../../src/domain/notes";
import { testNoteType } from "../../../support/notes/test-note-type";

it("exposes the field keys in declaration order and writes the record marker", () => {
  expect(testNoteType.keys).toEqual(["title", "points", "done", "due", "tags"]);
  expectTypeOf<(typeof testNoteType.keys)[number]>().toEqualTypeOf<
    "title" | "points" | "done" | "due" | "tags"
  >();
  expect(schemaMarker(testNoteType.type, testNoteType.version)).toBe(
    "product-engineering.test-record/v3",
  );
});

it("keeps valid known fields and reports every invalid form field in declaration order", () => {
  const result = testNoteType.check({
    title: null,
    points: Infinity,
    done: true,
    due: "2026-02-30",
    tags: ["ready", false],
    extension_key: "untouched",
  });
  expect(result).toEqual({
    values: { done: true },
    issues: [
      { key: "title", code: "field.missing" },
      { key: "points", code: "field.number" },
      { key: "due", code: "field.date" },
      { key: "tags", code: "field.list" },
    ],
  });
  expectTypeOf(result.values.points).toEqualTypeOf<number | undefined>();
});

it("treats null and missing optional form fields as unset", () => {
  expect(testNoteType.check({ title: "Open", points: null, tags: undefined })).toEqual({
    values: { title: "Open" },
    issues: [],
  });
});

it.each(["camelCase", "schema", "id"])("rejects a declaration using the field key %s", (key) => {
  expect(() =>
    defineNoteType({ ...testNoteType, fields: { [key]: testNoteType.fields.title } }),
  ).toThrow(TypeError);
});
