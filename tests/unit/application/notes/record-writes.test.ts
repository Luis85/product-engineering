import { it } from "@effect/vitest";
import { Effect } from "effect";
import { expect } from "vitest";
import { isInFolder, NoteStore, recordFolder } from "../../../../src/application/notes";
import { Messages } from "../../../../src/application/shell";
import {
  recordFixture,
  sampleRecord,
  samples,
  sampleType,
} from "../../../support/notes/record-fixture";
import { TEST_RECORD_ID } from "../../../support/notes/test-note-type";

it("joins a type folder under the configured root and recognizes paths by vault spelling rules", () => {
  expect(recordFolder("Team", sampleType)).toBe("Team/Tests/Records");
  expect(recordFolder("Team", {})).toBe("Team");
  expect(isInFolder("Café/records/Example.md", "Cafe\u0301/Records")).toBe(true);
  expect(isInFolder("Café/records-old/Example.md", "Café/Records")).toBe(false);
});

it.effect(
  "creates at the live settings root with stable IDs, ordered fields, a clash suffix and notices",
  () => {
    const fixture = recordFixture("Work/Shared");
    return Effect.gen(function* () {
      yield* fixture.ready;
      const values = {
        tags: ["team"],
        title: "Plan: Review",
        points: 0,
        ignored: "never a set field",
      };
      const first = yield* samples.create(values);
      const second = yield* samples.create(values);
      expect(first.path).toBe("Work/Shared/Tests/Records/Plan- Review.md");
      expect(second.path).toBe("Work/Shared/Tests/Records/Plan- Review (2).md");
      expect(first.frontmatter).toEqual({
        schema: "product-engineering.test-record/v3",
        id: TEST_RECORD_ID,
        title: "Plan: Review",
        points: 0,
        tags: ["team"],
      });
      expect(Object.keys(first.frontmatter)).toEqual(["schema", "id", "title", "points", "tags"]);
      expect(second.frontmatter.id).not.toBe(first.frontmatter.id);
      expect(yield* fixture.stored(first.path)).toEqual(first);
      const { notes } = yield* Messages;
      expect(fixture.notifier).toEqual(
        Array.from({ length: 2 }, () => ({
          severity: "info",
          title: notes.notices.created("Plan: Review"),
          detail: "",
        })),
      );
    }).pipe(Effect.provide(fixture.layer));
  },
);

it.effect(
  "removes the same identity after an outside rename and keeps a replacement at the stale path",
  () => {
    const fixture = recordFixture();
    return Effect.gen(function* () {
      const old = "Notes/Original.md";
      yield* fixture.notes.seed(old, sampleRecord("Original"));
      yield* fixture.ready;
      const row = (yield* samples.list).rows[0];
      if (!row) throw new Error("Expected the original indexed record");
      const store = yield* NoteStore;
      const moved = yield* store.rename(old, "Moved outside");
      const replacement = sampleRecord("Replacement", 101);
      yield* fixture.notes.seed(old, replacement);

      yield* samples.remove(row);

      expect(yield* fixture.storedPaths).toEqual([old]);
      expect(yield* fixture.stored(old)).toEqual({ path: old, frontmatter: replacement });
      expect((yield* Effect.flip(fixture.stored(moved.path)))._tag).toBe("NoteNotFoundError");
      const { notes } = yield* Messages;
      expect(fixture.notifier).toEqual([
        { severity: "info", title: notes.notices.deleted("Original"), detail: "" },
      ]);
    }).pipe(Effect.provide(fixture.layer));
  },
);

it.effect("refuses an edit or removal when another current file carries the same ID", () => {
  const fixture = recordFixture();
  return Effect.gen(function* () {
    const original = "Notes/Original.md";
    const copy = "Notes/New Copy.md";
    const frontmatter = sampleRecord("Original");
    yield* fixture.notes.seed(original, frontmatter);
    yield* fixture.ready;
    const row = (yield* samples.list).rows[0];
    if (!row) throw new Error("Expected the original indexed record");
    yield* fixture.notes.seed(copy, frontmatter);

    expect(yield* Effect.flip(samples.update(row, { title: "Changed" }))).toMatchObject({
      _tag: "NoteWriteRefusedError",
      reason: "duplicate-id",
    });
    expect(yield* Effect.flip(samples.remove(row))).toMatchObject({
      _tag: "NoteWriteRefusedError",
      reason: "duplicate-id",
    });
    expect(yield* fixture.storedPaths).toEqual([copy, original]);
    expect((yield* fixture.stored(original)).frontmatter).toEqual(frontmatter);
    expect(fixture.notifier).toEqual([]);
  }).pipe(Effect.provide(fixture.layer));
});

it.effect("refuses removal when the current path now belongs to a different identity", () => {
  const fixture = recordFixture();
  return Effect.gen(function* () {
    const path = "Notes/Original.md";
    yield* fixture.notes.seed(path, sampleRecord("Original"));
    yield* fixture.ready;
    const row = (yield* samples.list).rows[0];
    if (!row) throw new Error("Expected the original indexed record");
    const replacement = sampleRecord("Replacement", 101);
    yield* fixture.notes.seed(path, replacement);

    expect(yield* Effect.flip(samples.remove(row))).toMatchObject({
      _tag: "NoteWriteRefusedError",
      reason: "identity",
    });
    expect((yield* fixture.stored(path)).frontmatter).toEqual(replacement);
    expect(fixture.notifier).toEqual([]);
  }).pipe(Effect.provide(fixture.layer));
});
