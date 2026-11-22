import { it } from "@effect/vitest";
import { Effect, Exit, Option, Stream } from "effect";
import { expect } from "vitest";
import {
  NoteIndex,
  NoteIndexReadError,
  noteChanges,
  noteSnapshot,
  rebuildNoteIndex,
  unindexedChanges,
  unindexedSnapshot,
} from "../../../../src/application/notes";
import { schemaMarker } from "../../../../src/domain/notes";
import { indexFixture } from "../../../support/notes/index-fixture";
import { TEST_RECORD_ID, testNoteType } from "../../../support/notes/test-note-type";

const frontmatter = {
  schema: schemaMarker(testNoteType.type, testNoteType.version),
  id: TEST_RECORD_ID,
  title: "A complete note",
};

it.effect("treats a request for an unregistered note type as a defect", () => {
  const fixture = indexFixture([]);
  return Effect.gen(function* () {
    const query = yield* Effect.exit(NoteIndex.use((index) => index.noteSnapshot(testNoteType)));
    const subscription = yield* Effect.exit(Stream.runHead(noteChanges(testNoteType)));
    expect(Exit.hasDies(query)).toBe(true);
    expect(Exit.hasDies(subscription)).toBe(true);
  }).pipe(Effect.provide(fixture.layer));
});

it.effect(
  "builds once at VaultReady and makes the current snapshots available to subscribers",
  () => {
    const fixture = indexFixture();
    return Effect.gen(function* () {
      yield* fixture.notes.seed("Archive/Complete.md", frontmatter);
      yield* fixture.notes.seed("Records/Unreadable.md", "broken");
      yield* fixture.notes.seed("Archive/Unreadable.md", "broken");
      yield* fixture.publish({ _tag: "LayoutReady" });
      yield* Effect.yieldNow;

      const initial = yield* noteSnapshot(testNoteType);
      expect(initial).toEqual({ ready: false, failure: undefined, notes: [] });
      expect(Option.getOrThrow(yield* Stream.runHead(noteChanges(testNoteType)))).toBe(initial);
      expect(fixture.scans()).toEqual({ list: 0, unreadable: [] });

      yield* fixture.vaultReady;
      const indexed = yield* fixture.waitForSnapshot(testNoteType, (value) => value.ready);
      expect(indexed.notes).toMatchObject([{ path: "Archive/Complete.md", kind: "editable" }]);
      expect(fixture.scans()).toEqual({ list: 1, unreadable: ["Records"] });
      expect(fixture.reads()).toEqual([]);

      const unindexed = Option.getOrThrow(
        yield* Stream.runHead(Stream.filter(unindexedChanges, (value) => value.ready)),
      );
      expect(unindexed).toMatchObject({
        ready: true,
        notes: [{ path: "Records/Unreadable.md", issue: { code: "frontmatter.unreadable" } }],
      });
      expect(yield* unindexedSnapshot).toBe(unindexed);
    }).pipe(Effect.provide(fixture.layer));
  },
);

it.effect("keeps duplicate rows stable on an unchanged rebuild", () => {
  const fixture = indexFixture();
  return Effect.gen(function* () {
    yield* fixture.notes.seed("Records/Zeta.md", frontmatter);
    yield* fixture.notes.seed("Records/Alpha.md", frontmatter);
    yield* fixture.vaultReady;
    const first = yield* fixture.waitForSnapshot(testNoteType, (value) => value.ready);
    expect(first.notes).toMatchObject([
      {
        path: "Records/Alpha.md",
        kind: "read-only",
        issue: { code: "id.duplicate", other: "Records/Zeta.md" },
      },
      {
        path: "Records/Zeta.md",
        kind: "read-only",
        issue: { code: "id.duplicate", other: "Records/Alpha.md" },
      },
    ]);
    yield* rebuildNoteIndex;
    expect(yield* noteSnapshot(testNoteType)).toBe(first);
  }).pipe(Effect.provide(fixture.layer));
});

it.effect("clears a failed first snapshot when a rebuild succeeds", () => {
  const fixture = indexFixture();
  fixture.setFailUnreadable(true);
  return Effect.gen(function* () {
    yield* fixture.notes.seed("Archive/Complete.md", frontmatter);
    yield* fixture.vaultReady;
    const failed = yield* fixture.waitForSnapshot(
      testNoteType,
      (state) => state.failure !== undefined,
    );
    expect(failed).toMatchObject({
      ready: false,
      notes: [],
    });
    expect(failed.failure).toBeInstanceOf(NoteIndexReadError);

    fixture.setFailUnreadable(false);
    yield* rebuildNoteIndex;
    const rebuilt = yield* noteSnapshot(testNoteType);
    expect(rebuilt).toMatchObject({ ready: true, notes: [{ path: "Archive/Complete.md" }] });
    expect(rebuilt.failure).toBeUndefined();
    expect(fixture.scans()).toEqual({ list: 2, unreadable: ["Records", "Records"] });
  }).pipe(Effect.provide(fixture.layer));
});
