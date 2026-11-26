import { DEFAULT_SETTINGS } from "../../../../src/domain/shell";
import { it } from "@effect/vitest";
import { Deferred, Effect, Fiber, Stream } from "effect";
import { expect } from "vitest";
import { SettingsService } from "../../../../src/application/shell";
import { settingsFixture } from "../../../support/layers";

it.effect("publishes only changed values and notifies only when status changes", () => {
  const fixture = settingsFixture({ logLevel: "verbose" });
  return Effect.gen(function* () {
    const settings = yield* SettingsService;
    const ready = yield* Deferred.make<void>();
    const values = yield* Effect.forkChild(
      settings.changes.pipe(
        Stream.tap(() => Deferred.succeed(ready, undefined)),
        Stream.take(2),
        Stream.runCollect,
      ),
    );
    yield* Deferred.await(ready);
    yield* settings.reload;
    expect(fixture.notices).toHaveLength(1);
    fixture.store.writeExternally({ logLevel: "debug" });
    yield* settings.reload;

    expect(yield* Fiber.join(values)).toEqual([
      { ...DEFAULT_SETTINGS, logLevel: "warn" },
      { ...DEFAULT_SETTINGS, logLevel: "debug" },
    ]);
    expect(yield* settings.status).toEqual({ writable: true, issues: [] });
    expect(fixture.store.saved).toEqual([]);
  }).pipe(Effect.provide(fixture.layer));
});

it.effect("serializes a reload with a save already in progress", () => {
  const fixture = settingsFixture({ logLevel: "warn" });
  return Effect.gen(function* () {
    const settings = yield* SettingsService;
    fixture.store.holdSaves();
    const writer = yield* Effect.forkChild(settings.update({ logLevel: "info" }));
    yield* fixture.store.waitForHeldSave;
    const reload = yield* Effect.forkChild(settings.reload, { startImmediately: true });
    fixture.store.releaseSaves();
    yield* Fiber.join(writer);
    yield* Fiber.join(reload);
    expect(yield* settings.current).toEqual({ ...DEFAULT_SETTINGS, logLevel: "info" });
  }).pipe(Effect.provide(fixture.layer));
});
