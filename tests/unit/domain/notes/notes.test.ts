import { expect, it } from "vitest";
import {
  clashKey,
  clashName,
  isRecordFrontmatter,
  MAX_NAME_ATTEMPTS,
  noteNameIssue,
} from "../../../../src/domain/notes";

it("normalizes canonically equivalent names and applies locale-independent case folding", () => {
  expect(clashKey("ÜBER")).toBe(clashKey("U\u0308ber"));
  expect(clashKey("I")).toBe("i");
  expect(clashKey("I")).not.toBe(clashKey("ı"));
});

it("suffixes taken names from the second attempt through the fixed limit", () => {
  expect(clashName("Draft", 1)).toBe("Draft");
  expect(clashName("Draft", 2)).toBe("Draft (2)");
  expect(MAX_NAME_ATTEMPTS).toBe(100);
  expect(clashName("Draft", MAX_NAME_ATTEMPTS)).toBe("Draft (100)");
});

it.each([
  ["", "empty"],
  [" \t", "empty"],
  [".obsidian", "leading-dot"],
  ["  .hidden", "leading-dot"],
  ["..", "leading-dot"],
  ["Folder/Note", "forbidden-character"],
  ["Folder\\Note", "forbidden-character"],
  ['Title "quoted"', "forbidden-character"],
  ["Title\u0085Next", "forbidden-character"],
  ["An item's title", undefined],
])("validates note name %j", (name, issue) => {
  expect(noteNameIssue(name)).toBe(issue);
});

it("includes malformed plugin records without capturing unrelated notes", () => {
  expect(isRecordFrontmatter({ schema: "product-engineering.item/v1" })).toBe(true);
  expect(isRecordFrontmatter({ schema: "product-engineering.broken" })).toBe(true);
  expect(isRecordFrontmatter({ schema: "somebody-else.item/v1", id: "record" })).toBe(false);
  expect(isRecordFrontmatter({})).toBe(false);
});
