import { expect, it } from "vitest";
import { duplicateTitles, validateItem } from "../../../../src/domain/items";

it("checks a newly entered title against other valid titles using vault-name equality", () => {
  const input = { title: "  Résumé  ", status: "open", due: "" };
  expect(validateItem(input, { others: ["re\u0301sume\u0301"] })).toEqual({
    values: { title: "Résumé", status: "open" },
    issues: [{ key: "title", code: "title.taken" }],
  });
  expect(validateItem(input, { others: ["Resume"] })).toEqual({
    values: { title: "Résumé", status: "open" },
    issues: [],
  });
});

it("checks file-name length for a changed title and ordinary length through the field schema", () => {
  expect(validateItem({ title: "界".repeat(100), status: "open" }, { others: [] }).issues).toEqual([
    { key: "title", code: "title.too-long" },
  ]);
  expect(validateItem({ title: "x".repeat(101), status: "open" }, { others: [] }).issues).toEqual([
    { key: "title", code: "title.invalid" },
  ]);
});

it("keeps an unchanged title even when it is duplicated or its file name would be too long", () => {
  const title = " " + "界".repeat(98) + " ";
  const loaded = { title, status: "open" } as const;
  expect(validateItem({ title, status: "done" }, { others: [title], loaded })).toEqual({
    values: { title, status: "done" },
    issues: [],
  });
  expect(
    validateItem({ title: title.trim(), status: "done" }, { others: [title.trim()], loaded })
      .issues,
  ).toEqual([{ key: "title", code: "title.too-long" }]);
});

it("marks every NFC/case-equivalent title group without flattening accents", () => {
  expect(
    duplicateTitles(["Résumé", "re\u0301sume\u0301", "Resume", "Another", "ANOTHER", "another"]),
  ).toEqual(new Set(["résumé", "another"]));
});
