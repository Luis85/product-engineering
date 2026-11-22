import { it } from "@effect/vitest";
import { Cause, Context, Deferred, Effect, Exit, Fiber, Layer, Scope } from "effect";
import { expect } from "vitest";
import { NoteIndex } from "../../../../src/application/notes";
import { SettingsService } from "../../../../src/application/shell";
import { schemaMarker } from "../../../../src/domain/notes";
import { indexFixture } from "../../../support/notes/index-fixture";
import { TEST_RECORD_ID, testNoteType } from "../../../support/notes/test-note-type";

it.effect("satisfies an early rebuild from the first ready build without a second scan", () => {
  const fixture = indexFixture();
  return Effect.gen(function* () {
    const index = yield* NoteIndex;
    const rebuilt = yield* Deferred.make<void>();
    const pending = yield* Effect.forkChild(
      index.rebuild.pipe(Effect.tap(() => Deferred.succeed(rebuilt, undefined))),
      { startImmediately: true },
    );
    expect(yield* Deferred.isDone(rebuilt)).toBe(false);
    expect(fixture.scans().list).toBe(0);
    yield* fixture.vaultReady;
    yield* Fiber.join(pending);
    expect((yield* index.noteSnapshot(testNoteType)).ready).toBe(true);
    expect(fixture.scans().list).toBe(1);
  }).pipe(Effect.provide(fixture.layer));
});

it.effect("rebuilds after root-folder changes while ignoring other settings changes", () => {
  const fixture = indexFixture();
  return Effect.gen(function* () {
    const index = yield* NoteIndex;
    const settings = yield* SettingsService;
    yield* fixture.notes.seed("Other/Broken.md", "broken");
    yield* fixture.vaultReady;
    yield* fixture.waitForSnapshot(testNoteType, ({ ready }) => ready);
    expect((yield* index.unindexedSnapshot).notes).toEqual([]);
    yield* settings.update({ logLevel: "debug" });
    yield* fixture.advanceBatch;
    expect(fixture.scans().unreadable).toEqual(["Records"]);

    yield* settings.update({ rootFolder: "Other" });
    yield* fixture.advanceBatch;
    expect(fixture.scans().unreadable).toEqual(["Records", "Other"]);
    expect((yield* index.unindexedSnapshot).notes[0]?.path).toBe("Other/Broken.md");
  }).pipe(Effect.provide(fixture.layer));
});

it.effect(
  "interrupts rebuild waiters on disposal and makes later requests return immediately",
  () => {
    const fixture = indexFixture();
    return Effect.gen(function* () {
      const scope = yield* Scope.make();
      const context = yield* Layer.buildWithScope(fixture.layer, scope);
      const index = Context.get(context, NoteIndex);
      const pending = yield* Effect.forkChild(index.rebuild, { startImmediately: true });
      yield* Scope.close(scope, Exit.void);
      const stopped = yield* Fiber.await(pending);
      expect(Exit.isFailure(stopped) && Cause.hasInterruptsOnly(stopped.cause)).toBe(true);
      yield* index.rebuild;
      expect(fixture.scans()).toEqual({ list: 0, unreadable: [] });
      expect((yield* index.noteSnapshot(testNoteType)).ready).toBe(false);
    });
  },
);

it.effect("reports one build defect and accepts a later rebuild", () => {
  const fixture = indexFixture();
  return Effect.gen(function* () {
    const index = yield* NoteIndex;
    fixture.setDieList(true);
    const pending = yield* Effect.forkChild(index.rebuild, { startImmediately: true });
    yield* fixture.vaultReady;
    yield* Fiber.join(pending);
    expect(fixture.notifier).toHaveLength(1);
    expect(fixture.logger.filter(({ event }) => event === "defect.reported")).toHaveLength(1);
    expect((yield* index.noteSnapshot(testNoteType)).ready).toBe(false);
    fixture.setDieList(false);
    yield* index.rebuild;
    expect((yield* index.noteSnapshot(testNoteType)).ready).toBe(true);
  }).pipe(Effect.provide(fixture.layer));
});

it.effect("keeps snapshots empty until the first successful full scan", () => {
  const fixture = indexFixture();
  return Effect.gen(function* () {
    const index = yield* NoteIndex;
    fixture.setFailList(true);
    yield* fixture.vaultReady;
    const failed = yield* fixture.waitForSnapshot(
      testNoteType,
      ({ failure }) => failure !== undefined,
    );
    expect(failed.ready).toBe(false);
    expect(failed.notes).toEqual([]);

    const path = "Records/After failure.md";
    fixture.setFailList(false);
    yield* fixture.notes.seed(path, {
      schema: schemaMarker(testNoteType.type, testNoteType.version),
      id: TEST_RECORD_ID,
      title: "New",
    });
    yield* fixture.advanceBatch;
    expect(fixture.reads()).toEqual([path]);
    expect(yield* index.noteSnapshot(testNoteType)).toBe(failed);

    yield* index.rebuild;
    const recovered = yield* index.noteSnapshot(testNoteType);
    expect(recovered.ready).toBe(true);
    expect(recovered.failure).toBeUndefined();
    expect(recovered.notes.map((note) => note.path)).toEqual([path]);
  }).pipe(Effect.provide(fixture.layer));
});
