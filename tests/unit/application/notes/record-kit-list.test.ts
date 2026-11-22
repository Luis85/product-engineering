import { it } from "@effect/vitest";
import { Effect, Fiber, Stream } from "effect";
import { expect, vi } from "vitest";
import { Messages } from "../../../../src/application/shell";
import { recordFixture, sampleRecord, samples } from "../../../support/notes/record-fixture";

it.effect("reads the sorted index only and publishes fresh rows after an indexed change", () => {
  const fixture = recordFixture();
  return Effect.gen(function* () {
    const alpha = "Path/First.md";
    const beta = "Path/Second.md";
    yield* fixture.notes.seed(alpha, sampleRecord("Record 11"));
    yield* fixture.notes.seed(beta, sampleRecord("Record 2", 101));
    yield* fixture.ready;
    const first = yield* samples.list;
    expect(first.rows.map((row) => samples.shownName(row))).toEqual(["Record 2", "Record 11"]);
    const watch = yield* Effect.forkChild(samples.changes.pipe(Stream.take(2), Stream.runCollect), {
      startImmediately: true,
    });

    yield* fixture.notes.seed(alpha, sampleRecord("Record 1"));
    expect((yield* samples.list).rows[1]?.values.title).toBe("Record 11");
    yield* fixture.indexed;
    const [before, after] = yield* Fiber.join(watch);

    expect(before).toEqual(first);
    expect(after?.rows.map((row) => row.path)).toEqual([alpha, beta]);
    expect(after?.rows[0]?.values.title).toBe("Record 1");
    expect(fixture.scans().list).toBe(1);
  }).pipe(Effect.provide(fixture.layer));
});

it.effect("applies German title collation in the English UI", () => {
  const fixture = recordFixture();
  return Effect.gen(function* () {
    yield* fixture.notes.seed("Äpfel.md", sampleRecord("Äpfel 10"));
    yield* fixture.notes.seed("Apfel.md", sampleRecord("Apfel 2", 101));
    yield* fixture.ready;
    expect((yield* Messages).shell.language).toBe("en");
    const compare = vi.spyOn(String.prototype, "localeCompare");
    try {
      const first = yield* samples.list;
      const streamed = yield* samples.changes.pipe(Stream.runHead);
      expect(first.rows.map(samples.shownName)).toEqual(["Apfel 2", "Äpfel 10"]);
      expect(streamed).toMatchObject({ _tag: "Some", value: first });
      expect(compare.mock.calls).toHaveLength(2);
      for (const [, locale, options] of compare.mock.calls) {
        expect(locale).toBe("de");
        expect(options).toEqual({ numeric: true });
      }
    } finally {
      compare.mockRestore();
    }
  }).pipe(Effect.provide(fixture.layer));
});
