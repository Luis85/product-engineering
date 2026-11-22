import { it } from "@effect/vitest";
import { Effect } from "effect";
import { expect } from "vitest";
import { Logger, SettingsService } from "../../../../src/application/shell";
import { shellFixture } from "../../../support/layers";

it.effect("filters by the current log level and retains the last 50 accepted entries", () => {
  const fixture = shellFixture({ logLevel: "warn" });
  return Effect.gen(function* () {
    const logger = yield* Logger;
    const settings = yield* SettingsService;
    yield* logger.log({ level: "info", event: "plugin.loaded", data: { accepted: false } });
    expect(fixture.log).toEqual([]);
    yield* settings.update({ logLevel: "debug" });

    for (let count = 0; count < 52; count += 1) {
      yield* logger.log({ level: "debug", event: "plugin.loaded", data: { count } });
    }
    const recent = yield* logger.recent;
    expect(fixture.log).toHaveLength(52);
    expect(recent).toHaveLength(50);
    expect(recent[0]?.data).toEqual({ count: 2 });
    expect(recent.at(-1)?.data).toEqual({ count: 51 });
  }).pipe(Effect.provide(fixture.layer));
});

it.effect("accepts every level in development mode", () => {
  const fixture = shellFixture({ logLevel: "error" }, { developmentMode: true });
  return Effect.gen(function* () {
    const logger = yield* Logger;
    yield* logger.log({ level: "debug", event: "plugin.loaded" });
    expect(yield* logger.recent).toMatchObject([{ level: "debug", event: "plugin.loaded" }]);
    expect(fixture.log).toHaveLength(1);
  }).pipe(Effect.provide(fixture.layer));
});
