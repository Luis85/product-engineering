import * as fc from "fast-check";
import { expect, it } from "vitest";
import { parse } from "yaml";
import { newNoteText, yamlEntry } from "../../../../src/domain/notes";

const versions = ["1.2", "1.1"] as const;
const usableText = fc
  .array(fc.integer({ min: 0, max: 0xffff }), { maxLength: 30 })
  .map((units) => String.fromCharCode(...units));
const scalar = fc.oneof(
  fc.string(),
  usableText,
  fc.double(),
  fc.constantFrom(NaN, Infinity, -Infinity, -0),
  fc.boolean(),
  fc.constant(null),
);

it.each([
  "01067",
  "1.10",
  "yes",
  "12:30",
  "2026-11-22\n",
  "",
  " x",
  "x ",
  "test: detail",
  "test # tag",
  "!literal",
])("double-quotes text that either YAML grammar can misread %j", (value) => {
  const entry = yamlEntry("value", value, "\n");
  expect(entry).toBe("value: " + JSON.stringify(value) + "\n");
  for (const version of versions) expect(parse(entry, { version })).toEqual({ value });
});

it("keeps ordinary text and date lexemes plain while preserving their string type", () => {
  expect(yamlEntry("title", "A regular note", "\n")).toBe("title: A regular note\n");
  const date = yamlEntry("due", "2026-11-22", "\n");
  expect(date).toBe("due: !!str 2026-11-22\n");
  for (const version of versions) expect(parse(date, { version })).toEqual({ due: "2026-11-22" });
});

it("escapes YAML line separators, the BOM, and nonprinting characters", () => {
  const value = "a\u0085b\u2028c\u2029d\ufeffe\u007ff\u0000g\u000bh";
  const entry = yamlEntry("title", value, "\r\n");
  expect(entry).toBe('title: "a\\u0085b\\u2028c\\u2029d\\ufeffe\\u007ff\\u0000g\\u000bh"\r\n');
  for (const version of versions) expect(parse(entry, { version })).toEqual({ title: value });
});

it("round-trips flat scalar values and lists under YAML 1.1 and 1.2", () => {
  fc.assert(
    fc.property(fc.oneof(scalar, fc.array(scalar, { maxLength: 8 })), (value) => {
      const entry = yamlEntry("value", value, "\n");
      for (const version of versions) expect(parse(entry, { version })).toStrictEqual({ value });
    }),
    { numRuns: 500, examples: [[["e0"]]] },
  );
});

it("rejects nested values and explicit undefined entries", () => {
  for (const value of [
    undefined,
    { nested: true },
    [{ nested: true }],
    [["nested"]],
    [undefined],
  ]) {
    expect(() => yamlEntry("value", value, "\n")).toThrow("Unsupported frontmatter value");
  }
});

it("writes defined frontmatter in place and otherwise leaves the body alone", () => {
  const body = "A body with\r\nits original newlines.";
  expect(
    newNoteText(
      { schema: "product-engineering.item/v1", skipped: undefined, title: "Draft" },
      body,
    ),
  ).toBe("---\nschema: product-engineering.item/v1\ntitle: Draft\n---\n" + body);
  expect(newNoteText({ skipped: undefined }, body)).toBe(body);
  expect(newNoteText({}, body)).toBe(body);
  expect(newNoteText({})).toBe("");
});
