import { DEFAULT_SETTINGS } from "../../../src/domain/shell";
import { Context, Effect, Layer } from "effect";
import { expect, expectTypeOf, it, vi } from "vitest";
import type { AppEvent } from "../../../src/application/events";
import { defineModule, servicesLayerOf } from "../../../src/application/module";
import type { ServicesOf } from "../../../src/application/module";
import { EventBus, Logger, Messages, SettingsService } from "../../../src/application/shell";
import { testRuntime } from "../../support/runtime";

const probe = vi.hoisted(() => ({
  read: undefined as Effect.Effect<AppEvent[]> | undefined,
}));

vi.mock("../../../src/application/modules", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../../src/application/modules")>();
  const { Effect: ProbeEffect, Layer: ProbeLayer, Stream } = await import("effect");
  const { EventBus: ProbeBus } = await import("../../../src/application/shell");

  const services = ProbeLayer.effectDiscard(
    ProbeEffect.gen(function* () {
      const bus = yield* ProbeBus;
      const outcomes = yield* bus.subscribe;
      probe.read = outcomes.pipe(Stream.take(1), Stream.runCollect);
    }),
  );

  return {
    ...original,
    APP_MODULES: [...original.APP_MODULES, { ...original.APP_MODULES[0], services }],
  };
});

it("builds a subscribing feature before the host emits layout readiness", async () => {
  probe.read = undefined;
  const adapter = Layer.effectDiscard(
    Effect.gen(function* () {
      const bus = yield* EventBus;
      yield* bus.publish({ _tag: "LayoutReady" });
    }),
  );
  const fixture = testRuntime({ hostEvents: adapter });
  try {
    await fixture.runtime.runPromise(Effect.void);
    const read = probe.read;
    expect(read).toBeDefined();
    if (!read) throw new Error("The consumer was not built");
    await expect(fixture.runtime.runPromise(Effect.timeout(read, "1 second"))).resolves.toEqual([
      { _tag: "LayoutReady" },
    ]);
  } finally {
    await fixture.runtime.dispose();
  }
});

it("uses host settings, language, and logging adapters in the same graph", async () => {
  const fixture = testRuntime({
    initialSettings: { logLevel: "error" },
    language: "en",
    developmentMode: false,
  });
  try {
    await fixture.runtime.runPromise(
      Effect.gen(function* () {
        const settings = yield* SettingsService;
        const messages = yield* Messages;
        const logger = yield* Logger;
        expect(yield* settings.current).toEqual({ ...DEFAULT_SETTINGS, logLevel: "error" });
        expect(messages.shell.language).toBe("en");
        yield* logger.log({ level: "debug", event: "plugin.loaded" });
        yield* logger.log({ level: "error", event: "plugin.loaded" });
      }),
    );
    expect(fixture.logger).toMatchObject([{ level: "error", event: "plugin.loaded" }]);
  } finally {
    await fixture.runtime.dispose();
  }
});

it("combines independently declared feature service types", async () => {
  class ClockFeature extends Context.Service<ClockFeature, number>()("test/ClockFeature") {}
  class LabelFeature extends Context.Service<LabelFeature, string>()("test/LabelFeature") {}
  const catalog = { en: {}, de: {} };
  const modules = [
    defineModule({
      name: "clock",
      catalog,
      services: Layer.succeed(ClockFeature, 3),
    }),
    defineModule({
      name: "label",
      catalog,
      services: Layer.succeed(LabelFeature, "record"),
    }),
  ] as const;
  const combined = servicesLayerOf(modules);
  expectTypeOf<ServicesOf<(typeof modules)[number]>>().toEqualTypeOf<ClockFeature | LabelFeature>();
  expectTypeOf<Layer.Success<typeof combined>>().toEqualTypeOf<ClockFeature | LabelFeature>();

  await expect(
    Effect.runPromise(Effect.all([ClockFeature, LabelFeature]).pipe(Effect.provide(combined))),
  ).resolves.toEqual([3, "record"]);
});
