import { expect, it } from "vitest";
import {
  fitsFileName,
  followsTitle,
  MAX_FILE_NAME_BYTES,
  recordFileName,
} from "../../../../src/domain/notes";

it("replaces whole runs of unsafe characters and tidies spaces and dots at the edges", () => {
  const unsafeRun = '\\/:*?"<>|#^[]' + String.fromCharCode(0, 127, 159);
  expect(recordFileName(" .. Milestone" + unsafeRun + "   A\u00a0 B .. ", "Record")).toBe(
    "Milestone- A B",
  );
  expect(recordFileName("Alpha/Beta:Gamma\nDelta", "Record")).toBe("Alpha-Beta-Gamma-Delta");
  expect(recordFileName(" ... . ", "Eintrag")).toBe("Eintrag");
});

it("counts UTF-8 bytes after reserving the largest suffix and Markdown extension", () => {
  expect(MAX_FILE_NAME_BYTES).toBe(255);
  expect(fitsFileName("x".repeat(246), "Record")).toBe(true);
  expect(fitsFileName("x".repeat(247), "Record")).toBe(false);
  expect(fitsFileName("界".repeat(82), "Record")).toBe(true);
  expect(fitsFileName("界".repeat(83), "Record")).toBe(false);
  expect(fitsFileName("界".repeat(100), "Record")).toBe(false);
  expect(fitsFileName("...", "x".repeat(247))).toBe(false);
});

it("uses the fallback when only forbidden characters, dots, and spaces remain", () => {
  expect(recordFileName(" ??? . # [ ] ", "Item")).toBe("Item");
  expect(recordFileName("-", "Item")).toBe("-");
  expect(recordFileName(" /-? ", "Item")).toBe("---");
  expect(followsTitle("Item (2)", "???", "Item")).toBe(true);
});

it("follows exact and generated clash names using the vault's name comparison", () => {
  const title = "Résumé / Milestone";
  for (const generated of [
    "re\u0301sume\u0301 - milestone",
    "Résumé - Milestone (2)",
    "Résumé - Milestone (100)",
  ]) {
    expect(followsTitle(generated, title, "Record")).toBe(true);
  }
  for (const manual of [
    "Different title",
    "Résumé - Milestone (1)",
    "Résumé - Milestone (02)",
    "Résumé - Milestone (101)",
    "Résumé - Milestone (2) draft",
  ]) {
    expect(followsTitle(manual, title, "Record")).toBe(false);
  }
  expect(followsTitle("Record (99)", "...", "Record")).toBe(true);
});
