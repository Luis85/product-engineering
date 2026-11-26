import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import {
  REFERENCE_PROFILE,
  referenceVault,
  writeReferenceVault,
} from "../../../scripts/reference-vault.mjs";

it("reproduces the same bytes for the same seed and scales the measured profile", () => {
  const sizes = { items: 2, records: 5, plain: 2 };
  const first = referenceVault({ seed: 12, ...sizes });
  expect(first.size).toBe(7);
  expect(first).toEqual(referenceVault({ seed: 12, ...sizes }));
  expect(first).not.toEqual(referenceVault({ seed: 18, ...sizes }));
  expect(REFERENCE_PROFILE.records).toBe(2_000);
  expect(REFERENCE_PROFILE.plain).toBe(200);
  expect(referenceVault().size).toBe(2_200);
});

it("generates two stable record kinds and plain Markdown without properties", () => {
  const notes = referenceVault({ seed: 12, items: 2, records: 5, plain: 2 });
  const files = [...notes.values()];
  expect(files.filter((text) => text.includes("schema: product-engineering.item/v1"))).toHaveLength(
    2,
  );
  expect(
    files.filter((text) => text.includes("schema: product-engineering.entry/v1")),
  ).toHaveLength(3);
  expect(files.filter((text) => !text.startsWith("---\n"))).toHaveLength(2);
  expect(notes.get("Items/Item 1.md")).toContain("id: item-00000000-0000-0000-0000-000000000001");
  expect(notes.get("Entries/Area 1/Entry 1.md")).toContain("\ndate: ");
  expect(notes.get("Items/Item 1.md")).toContain("\ndue: ");
});

it("replaces the target fixture while preserving neighboring files", () => {
  const temporary = mkdtempSync(join(tmpdir(), "pe-reference-"));
  const target = join(temporary, "reference");
  mkdirSync(target);
  writeFileSync(join(target, "Stale.md"), "stale");
  writeFileSync(join(temporary, "Neighbor.md"), "preserved");
  try {
    const profile = { seed: 12, items: 2, records: 5, plain: 2 };
    writeReferenceVault(target, profile);
    for (const [path, text] of referenceVault(profile)) {
      expect(readFileSync(join(target, path), "utf8")).toBe(text);
    }
    expect(() => readFileSync(join(target, "Stale.md"))).toThrow(/ENOENT/);
    expect(readFileSync(join(temporary, "Neighbor.md"), "utf8")).toBe("preserved");
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
});
