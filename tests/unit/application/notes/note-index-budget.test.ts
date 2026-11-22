import { it } from "@effect/vitest";
import { Effect } from "effect";
import { expect } from "vitest";
import { parse } from "yaml";
import { REFERENCE_PROFILE, referenceVault } from "../../../../scripts/reference-vault.mjs";
import { rebuildNoteIndex } from "../../../../src/application/notes";
import { frontmatterYaml, splitNoteText } from "../../../../src/domain/notes";
import { isPlainRecord } from "../../../../src/domain/shell";
import type { SeedFrontmatter } from "../../../support/notes/fixture";
import { countingType, indexFixture } from "../../../support/notes/index-fixture";
import { referenceEntryType, referenceItemType } from "../../../support/notes/reference-types";

function frontmatterOf(text: string): SeedFrontmatter {
  const yaml = frontmatterYaml(splitNoteText(text));
  if (yaml === undefined) return "none";
  const frontmatter: unknown = parse(yaml);
  if (!isPlainRecord(frontmatter)) throw new Error("Expected a reference note with properties");
  return frontmatter;
}

it.effect("decodes each reference record once and only rereads the edited reference path", () => {
  const items = countingType(referenceItemType);
  const entries = countingType(referenceEntryType);
  const fixture = indexFixture([items.type, entries.type]);
  const itemCount = REFERENCE_PROFILE.items;
  const entryCount = REFERENCE_PROFILE.records - itemCount;

  return Effect.gen(function* () {
    for (const [path, text] of referenceVault()) {
      yield* fixture.notes.seed(path, frontmatterOf(text));
    }
    yield* fixture.vaultReady;
    const firstItems = yield* fixture.waitForSnapshot(items.type, (snapshot) => snapshot.ready);
    const firstEntries = yield* fixture.waitForSnapshot(entries.type, (snapshot) => snapshot.ready);
    expect(firstItems.notes).toHaveLength(itemCount);
    expect(firstEntries.notes).toHaveLength(entryCount);
    expect(
      firstItems.notes.every((note) => note.kind === "editable" && note.issues.length === 0),
    ).toBe(true);
    expect(
      firstEntries.notes.every((note) => note.kind === "editable" && note.issues.length === 0),
    ).toBe(true);
    expect([items.decodes(), entries.decodes()]).toEqual([itemCount, entryCount]);
    expect(fixture.scans().list).toBe(1);
    expect(fixture.reads()).toEqual([]);

    yield* rebuildNoteIndex;
    expect([items.decodes(), entries.decodes()]).toEqual([itemCount, entryCount]);
    expect(fixture.scans().list).toBe(2);
    expect(fixture.reads()).toEqual([]);

    const note = firstItems.notes[0];
    if (!note) throw new Error("Expected at least one reference item");
    const title = "An outside edit";
    yield* fixture.notes.seed(note.path, { ...note.frontmatter, title });
    yield* fixture.advanceBatch;
    yield* fixture.waitForSnapshot(items.type, ({ notes }) =>
      notes.some(({ values }) => values.title === title),
    );
    expect([items.decodes(), entries.decodes()]).toEqual([itemCount + 1, entryCount]);
    expect(fixture.scans().list).toBe(2);
    expect(fixture.reads()).toEqual([note.path]);
  }).pipe(Effect.provide(fixture.layer));
});
