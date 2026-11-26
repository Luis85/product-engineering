import { it } from "@effect/vitest";
import { Deferred, Effect, Fiber, Stream } from "effect";
import * as TestClock from "effect/testing/TestClock";
import { expect } from "vitest";
import { NoteIndex, NoteIndexReadError, NoteStore } from "../../../../src/application/notes";
import {
  INDEX_BATCH_MAX,
  INDEX_BATCH_QUIET,
} from "../../../../src/application/notes/index-batches";
import { schemaMarker } from "../../../../src/domain/notes";
import { indexFixture } from "../../../support/notes/index-fixture";
import { TEST_RECORD_ID, testNoteType } from "../../../support/notes/test-note-type";

const path = "Records/Current.md";
const renamed = "Records/Renamed.md";
const meta = { _tag: "MetadataChanged", path, extension: "md" } as const;
const record = (title: string) => ({
  schema: schemaMarker("test-record", 3),
  id: TEST_RECORD_ID,
  title,
});

it.effect(
  "rereads an event received during the first build without doubling or republishing its note",
  () => {
    const fixture = indexFixture();
    return Effect.gen(function* () {
      const buildStarted = yield* Deferred.make<void>();
      const releaseBuild = yield* Deferred.make<void>();
      fixture.beforeNextList(
        Effect.asVoid(Deferred.succeed(buildStarted, undefined)).pipe(
          Effect.andThen(Deferred.await(releaseBuild)),
        ),
      );
      yield* fixture.publish({ ...meta, path: "Records/Old.md" });
      yield* fixture.vaultReady;
      yield* Deferred.await(buildStarted);
      yield* fixture.notes.seed(path, record("Present at the read"));
      yield* Deferred.succeed(releaseBuild, undefined);
      const first = yield* fixture.waitForSnapshot(testNoteType, ({ ready }) => ready);
      expect(first.notes.map((note) => note.path)).toEqual([path]);

      yield* fixture.advanceBatch;
      const index = yield* NoteIndex;
      expect(fixture.reads()).toEqual([path]);
      const afterRead = yield* index.noteSnapshot(testNoteType);
      expect(afterRead.notes).toHaveLength(1);
      expect(afterRead).toBe(first);
      expect(fixture.scans().list).toBe(1);
    }).pipe(Effect.provide(fixture.layer));
  },
);

it.effect("ignores pre-cache events and coalesces renames and repeated metadata by path", () => {
  const fixture = indexFixture();
  return Effect.gen(function* () {
    yield* fixture.notes.seed(path, record("Initial"));
    yield* fixture.vaultReady;
    const atReady = yield* fixture.waitForSnapshot(testNoteType, ({ ready }) => ready);
    const index = yield* NoteIndex;
    const store = yield* NoteStore;
    yield* fixture.publish({ ...meta, _tag: "FileCreated" });
    yield* fixture.publish({ ...meta, _tag: "FileModified" });
    yield* fixture.publish({ ...meta, extension: "canvas" });
    yield* fixture.advanceBatch;
    expect(fixture.reads()).toEqual([]);

    const values = yield* Effect.forkChild(
      index.noteChanges(testNoteType).pipe(Stream.take(2), Stream.runCollect),
      { startImmediately: true },
    );
    yield* store.rename(path, "Renamed");
    yield* fixture.publish({ ...meta, path: renamed });
    yield* fixture.publish({ ...meta, path: renamed });
    yield* fixture.advanceBatch;
    const [initial, changed] = yield* Fiber.join(values);
    expect(initial).toBe(atReady);
    expect(changed?.notes.map((note) => note.path)).toEqual([renamed]);
    expect(fixture.reads().toSorted()).toEqual([path, renamed].toSorted());

    yield* fixture.notes.removeOutside(renamed);
    yield* fixture.advanceBatch;
    expect((yield* index.noteSnapshot(testNoteType)).notes).toEqual([]);
  }).pipe(Effect.provide(fixture.layer));
});

it.effect("closes a busy batch at its maximum age even without a quiet window", () => {
  const fixture = indexFixture();
  return Effect.gen(function* () {
    yield* fixture.vaultReady;
    yield* fixture.waitForSnapshot(testNoteType, ({ ready }) => ready);
    yield* fixture.notes.seed(path, record("Busy"));
    const interval = INDEX_BATCH_QUIET * 0.8;
    const intervals = Math.floor((INDEX_BATCH_MAX - 1) / interval);
    for (let index = 0; index < intervals; index += 1) {
      yield* TestClock.adjust(interval);
      yield* fixture.publish(meta);
    }
    expect(fixture.reads()).toEqual([]);
    yield* TestClock.adjust(INDEX_BATCH_MAX - intervals * interval);
    const snapshot = yield* fixture.waitForSnapshot(
      testNoteType,
      ({ notes }) => notes.length === 1,
    );
    expect(snapshot.notes[0]?.values.title).toBe("Busy");
    expect(fixture.reads()).toEqual([path]);
  }).pipe(Effect.provide(fixture.layer));
});

it.effect(
  "keeps the last notes after a failed read and clears failure on a successful rebuild",
  () => {
    const fixture = indexFixture();
    return Effect.gen(function* () {
      yield* fixture.notes.seed(path, record("Old"));
      yield* fixture.vaultReady;
      const first = yield* fixture.waitForSnapshot(testNoteType, ({ ready }) => ready);
      fixture.setFailRead(true);
      yield* fixture.notes.seed(path, record("Updated"));
      yield* fixture.advanceBatch;
      const failed = yield* fixture.waitForSnapshot(
        testNoteType,
        ({ failure }) => failure !== undefined,
      );
      expect(failed.failure).toBeInstanceOf(NoteIndexReadError);
      expect(failed.ready).toBe(true);
      expect(failed.notes).toBe(first.notes);
      expect(fixture.logger.at(-1)?.event).toBe("notes.index.read.failed");

      fixture.setFailRead(false);
      yield* fixture.publish(meta);
      yield* fixture.advanceBatch;
      const index = yield* NoteIndex;
      const updated = yield* index.noteSnapshot(testNoteType);
      expect(updated.notes[0]?.values.title).toBe("Updated");
      expect(updated.failure).toBe(failed.failure);
      yield* index.rebuild;
      expect((yield* index.noteSnapshot(testNoteType)).failure).toBeUndefined();
    }).pipe(Effect.provide(fixture.layer));
  },
);
