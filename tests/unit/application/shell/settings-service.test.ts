import { DEFAULT_SETTINGS } from "../../../../src/domain/shell";
import { it } from "@effect/vitest";
import { Effect, Stream } from "effect";
import { expect } from "vitest";
import { SettingsService } from "../../../../src/application/shell";
import { settingsFixture } from "../../../support/layers";

it.effect("loads valid settings and publishes the current value without saving", () => {
  const fixture = settingsFixture({ logLevel: "info" });
  return Effect.gen(function* () {
    const settings = yield* SettingsService;
    expect(yield* settings.current).toEqual({ ...DEFAULT_SETTINGS, logLevel: "info" });
    expect(yield* settings.status).toEqual({ writable: true, issues: [] });
    expect(yield* Stream.runCollect(Stream.take(settings.changes, 1))).toEqual([
      { ...DEFAULT_SETTINGS, logLevel: "info" },
    ]);
    expect(yield* Stream.runCollect(Stream.take(settings.statusChanges, 1))).toEqual([
      { writable: true, issues: [] },
    ]);
    expect(fixture.store.saved).toEqual([]);
    expect(fixture.notices).toEqual([]);
  }).pipe(Effect.provide(fixture.layer));
});

it.effect("reports a rejected field once and writes canonical data only on update", () => {
  const fixture = settingsFixture({ logLevel: "verbose", oldKey: true });
  return Effect.gen(function* () {
    const settings = yield* SettingsService;
    expect(fixture.notices).toHaveLength(1);
    expect(yield* settings.current).toEqual({ ...DEFAULT_SETTINGS, logLevel: "warn" });
    expect(fixture.store.saved).toEqual([]);
    yield* settings.update({ logLevel: "debug" });
    expect(fixture.store.saved).toEqual([{ schemaVersion: 1, logLevel: "debug" }]);
    expect(yield* settings.current).toEqual({ ...DEFAULT_SETTINGS, logLevel: "debug" });
    expect(yield* settings.status).toEqual({ writable: true, issues: [] });
  }).pipe(Effect.provide(fixture.layer));
});

it.effect("preserves a newer or unavailable settings file", () => {
  const fixture = settingsFixture({ schemaVersion: 3, logLevel: "debug" });
  return Effect.gen(function* () {
    const settings = yield* SettingsService;
    expect(fixture.notices).toHaveLength(1);
    expect(yield* Effect.flip(settings.update({ logLevel: "info" }))).toMatchObject({
      _tag: "ReadOnlySettingsError",
      reason: "newer-version",
    });
    fixture.store.setFailLoad(true);
    yield* settings.reload;
    expect(yield* settings.status).toMatchObject({ writable: false, readOnlyReason: "unreadable" });
    expect(fixture.notices).toHaveLength(2);
    expect(fixture.store.saved).toEqual([]);
  }).pipe(Effect.provide(fixture.layer));
});

it.effect("rejects invalid patches and preserves the current value when saving fails", () => {
  const fixture = settingsFixture({ logLevel: "info" });
  return Effect.gen(function* () {
    const settings = yield* SettingsService;
    expect(yield* Effect.flip(settings.update({ logLevel: "trace" }))).toMatchObject({
      _tag: "InvalidSettingsError",
      issues: [{ code: "logLevel.unknown" }],
    });
    fixture.store.setFailSave(true);
    expect(yield* Effect.flip(settings.update({ logLevel: "error" }))).toMatchObject({
      _tag: "StorageError",
    });
    expect(yield* settings.current).toEqual({ ...DEFAULT_SETTINGS, logLevel: "info" });
    expect(fixture.store.saved).toEqual([]);
  }).pipe(Effect.provide(fixture.layer));
});
