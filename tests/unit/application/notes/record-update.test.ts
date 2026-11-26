import { it } from "@effect/vitest";
import { Deferred, Effect, Fiber } from "effect";
import { expect } from "vitest";
import { NoteStore } from "../../../../src/application/notes";
import { Messages } from "../../../../src/application/shell";
import { recordFixture, sampleRecord, samples } from "../../../support/notes/record-fixture";

const readRow = Effect.map(samples.list, ({ rows }) => {
  const row = rows.find((value) => value.values.title === "Original");
  if (!row) throw new Error("Expected the original indexed record");
  return row;
});

it.effect(
  "merges an outside field change and follows an auto-named file through target clashes",
  () => {
    const fixture = recordFixture();
    return Effect.gen(function* () {
      const original = "Other/Original (2).md";
      const body = "Preserve the body.\r\n";
      const before = sampleRecord("Original", 100, { points: 1, user_key: "keep" });
      yield* fixture.notes.seed(original, before, body);
      yield* fixture.notes.seed("Other/Renamed.md", sampleRecord("Occupied", 101));
      yield* fixture.notes.seed("Other/Renamed (2).md", sampleRecord("Occupied again", 102));
      yield* fixture.ready;
      const row = yield* readRow;
      yield* fixture.notes.seed(original, { ...before, points: 3, another_key: "new" }, body);

      const saved = yield* samples.update(row, { title: "Renamed", points: 1 });

      expect(saved).toEqual({
        path: "Other/Renamed (3).md",
        frontmatter: { ...before, title: "Renamed", points: 3, another_key: "new" },
      });
      expect(yield* fixture.stored(saved.path)).toEqual(saved);
      expect(fixture.notes.body(saved.path)).toBe(body);
      expect(fixture.notes.body(original)).toBeUndefined();
      const { notes } = yield* Messages;
      expect(fixture.notifier).toEqual([
        { severity: "info", title: notes.notices.saved("Renamed"), detail: "" },
      ]);
    }).pipe(Effect.provide(fixture.layer));
  },
);

it.effect("updates a stale row by ID and keeps the filename chosen outside the plugin", () => {
  const fixture = recordFixture();
  return Effect.gen(function* () {
    const original = "Other/Original.md";
    const raw = sampleRecord("Original");
    yield* fixture.notes.seed(original, raw);
    yield* fixture.ready;
    const row = yield* readRow;
    const store = yield* NoteStore;
    const moved = yield* store.rename(original, "My own file name");
    const replacement = sampleRecord("Replacement", 101);
    yield* fixture.notes.seed(original, replacement);

    const saved = yield* samples.update(row, { title: "Changed" });

    expect(saved).toEqual({ path: moved.path, frontmatter: { ...raw, title: "Changed" } });
    expect(yield* fixture.stored(original)).toEqual({ path: original, frontmatter: replacement });
    expect(yield* fixture.stored(moved.path)).toEqual(saved);
  }).pipe(Effect.provide(fixture.layer));
});

it.effect("does not rename when only an outside edit changed the title", () => {
  const fixture = recordFixture();
  return Effect.gen(function* () {
    const path = "Other/Original.md";
    const before = sampleRecord("Original", 100, { points: 1 });
    yield* fixture.notes.seed(path, before);
    yield* fixture.ready;
    const row = yield* readRow;
    yield* fixture.notes.seed(path, { ...before, title: "Changed outside" });

    const saved = yield* samples.update(row, { title: "Original", points: 2 });

    expect(saved).toEqual({
      path,
      frontmatter: { ...before, title: "Changed outside", points: 2 },
    });
    expect(yield* fixture.storedPaths).toEqual([path]);
  }).pipe(Effect.provide(fixture.layer));
});

it.effect("returns a typed field conflict and does not write or rename the note", () => {
  const fixture = recordFixture();
  return Effect.gen(function* () {
    const path = "Other/Original.md";
    const raw = sampleRecord("Original", 100, { points: 1 });
    yield* fixture.notes.seed(path, raw);
    yield* fixture.ready;
    const row = yield* readRow;
    const outside = { ...raw, title: "Outside" };
    yield* fixture.notes.seed(path, outside);

    expect(yield* Effect.flip(samples.update(row, { title: "Renamed", points: 3 }))).toMatchObject({
      _tag: "NoteEditConflictError",
      conflicts: [{ key: "title", base: "Original", edited: "Renamed", current: "Outside" }],
    });
    expect(yield* fixture.stored(path)).toEqual({ path, frontmatter: outside });
    expect(yield* fixture.storedPaths).toEqual([path]);
    expect(fixture.notifier).toEqual([]);
  }).pipe(Effect.provide(fixture.layer));
});

it.effect("keeps a saved patch when renaming fails and logs only the event", () => {
  const fixture = recordFixture();
  return Effect.gen(function* () {
    const path = "Other/Original.md";
    const raw = sampleRecord("Original", 100, { user_key: "sensitive value" });
    yield* fixture.notes.seed(path, raw);
    yield* fixture.ready;
    fixture.setFailRename(true);

    const saved = yield* samples.update(yield* readRow, { title: "Renamed" });

    expect(saved).toEqual({ path, frontmatter: { ...raw, title: "Renamed" } });
    expect(yield* fixture.stored(path)).toEqual(saved);
    expect(
      fixture.logger
        .filter(({ level }) => level === "warn")
        .map(({ timestamp: _timestamp, ...log }) => log),
    ).toEqual([{ level: "warn", event: "sample.rename.failed" }]);
    expect(fixture.notifier).toHaveLength(1);
  }).pipe(Effect.provide(fixture.layer));
});

it.effect("finishes the rename after interruption is requested between save and rename", () => {
  const fixture = recordFixture();
  return Effect.gen(function* () {
    const path = "Other/Original.md";
    yield* fixture.notes.seed(path, sampleRecord("Original"));
    yield* fixture.ready;
    const row = yield* readRow;
    const renameReached = yield* Deferred.make<void>();
    const resume = yield* Deferred.make<void>();
    fixture.beforeNextRename(
      Deferred.succeed(renameReached, undefined).pipe(Effect.andThen(Deferred.await(resume))),
    );
    const save = yield* Effect.forkChild(samples.update(row, { title: "Renamed" }), {
      startImmediately: true,
    });
    yield* Deferred.await(renameReached);
    expect((yield* fixture.stored(path)).frontmatter.title).toBe("Renamed");
    const interrupt = yield* Effect.forkChild(Fiber.interrupt(save), { startImmediately: true });
    yield* Deferred.succeed(resume, undefined);
    yield* Fiber.join(interrupt);

    expect(yield* fixture.storedPaths).toEqual(["Other/Renamed.md"]);
    expect(fixture.notifier).toHaveLength(1);
  }).pipe(Effect.provide(fixture.layer));
});
