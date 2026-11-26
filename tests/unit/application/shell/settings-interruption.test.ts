import { DEFAULT_SETTINGS } from "../../../../src/domain/shell";
import { it } from "@effect/vitest";
import { Effect, Fiber } from "effect";
import { expect } from "vitest";
import { SettingsService } from "../../../../src/application/shell";
import { settingsFixture } from "../../../support/layers";

it.effect("publishes a committed save even when its caller is interrupted during the write", () => {
  const fixture = settingsFixture({ logLevel: "warn" }, { uncancellableSaves: true });
  return Effect.gen(function* () {
    const settings = yield* SettingsService;
    fixture.store.holdSaves();
    const writer = yield* Effect.forkChild(settings.update({ logLevel: "info" }));
    yield* fixture.store.waitForHeldSave;
    expect(fixture.store.heldSaves).toHaveLength(1);
    const interrupt = yield* Effect.forkChild(Fiber.interrupt(writer), { startImmediately: true });
    yield* Effect.yieldNow;
    fixture.store.releaseSaves();
    yield* Fiber.join(interrupt);

    expect(fixture.store.saved).toEqual([{ schemaVersion: 1, logLevel: "info" }]);
    expect(yield* settings.current).toEqual({ ...DEFAULT_SETTINGS, logLevel: "info" });
  }).pipe(Effect.provide(fixture.layer));
});

it.effect("lets a caller waiting for an earlier save interrupt without writing", () => {
  const fixture = settingsFixture({ logLevel: "warn" });
  return Effect.gen(function* () {
    const settings = yield* SettingsService;
    fixture.store.holdSaves();
    const writer = yield* Effect.forkChild(settings.update({ logLevel: "info" }));
    yield* fixture.store.waitForHeldSave;
    const waiting = yield* Effect.forkChild(settings.update({ logLevel: "debug" }), {
      startImmediately: true,
    });
    yield* Fiber.interrupt(waiting);
    fixture.store.releaseSaves();
    yield* Fiber.join(writer);
    expect(fixture.store.saved).toEqual([{ schemaVersion: 1, logLevel: "info" }]);
  }).pipe(Effect.provide(fixture.layer));
});
