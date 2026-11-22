import { Effect, Random } from "effect";
import { afterEach, expect, it, vi } from "vitest";
import { Incidents, LogSink } from "../../../src/application/shell";
import { consoleSinkLayer } from "../../../src/infrastructure/logging/console-sink";
import { incidentsLayer } from "../../../src/infrastructure/logging/incidents";

afterEach(() => vi.restoreAllMocks());

it("prefixes console logs and directs info and debug to the debug channel", async () => {
  const debug = vi.spyOn(console, "debug").mockImplementation(() => {});
  const info = vi.spyOn(console, "info").mockImplementation(() => {});
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  const error = vi.spyOn(console, "error").mockImplementation(() => {});
  await Effect.runPromise(
    Effect.gen(function* () {
      const sink = yield* LogSink;
      for (const level of ["info", "debug", "warn", "error"] as const) {
        yield* sink.write({ level, event: "plugin.loaded", timestamp: 0 });
      }
    }).pipe(Effect.provide(consoleSinkLayer)),
  );
  expect(debug).toHaveBeenCalledTimes(2);
  expect(info).not.toHaveBeenCalled();
  expect(warn).toHaveBeenCalledWith(
    "[product-engineering]",
    expect.objectContaining({ level: "warn" }),
  );
  expect(error).toHaveBeenCalledWith(
    "[product-engineering]",
    expect.objectContaining({ level: "error" }),
  );
});

it("generates incident IDs from the six-character uppercase alphabet", async () => {
  const samples = await Effect.runPromise(
    Effect.gen(function* () {
      const incidents = yield* Incidents;
      return yield* Effect.forEach(Array.from({ length: 30 }), () => incidents.nextId);
    }).pipe(Effect.provide(incidentsLayer), Random.withSeed("incidents")),
  );
  expect(samples).toHaveLength(30);
  expect(samples.every((id) => /^[0-9A-Z]{6}$/.test(id))).toBe(true);
});
