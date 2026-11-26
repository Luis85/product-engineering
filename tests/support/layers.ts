import { Effect, Layer } from "effect";
import { appServicesLayer } from "../../src/application/app-services-layer";
import type { AppEvent } from "../../src/application/events";
import { messagesLayer } from "../../src/application/messages";
import {
  EventBus,
  EventBusLive,
  SettingsServiceLive,
  VaultReadError,
} from "../../src/application/shell";
import type { Language } from "../../src/application/shell";
import { testAdapters } from "./adapters";
import type { TestAdapterOptions } from "./adapters";

type FixtureOptions = Omit<TestAdapterOptions, "initialSettings"> & {
  readonly language?: Language;
  readonly developmentMode?: boolean;
};

const testMessages = (language: Language = "de") => messagesLayer(language);

export function settingsFixture(initial?: unknown, options: FixtureOptions = {}) {
  const {
    adapters,
    store,
    notifier: notices,
  } = testAdapters({ ...options, initialSettings: initial });
  const ports = Layer.mergeAll(
    adapters.settingsStore,
    adapters.notifier,
    testMessages(options.language),
  );
  return { store, notices, layer: Layer.provideMerge(SettingsServiceLive, ports) };
}

export function shellFixture(initial?: unknown, options: FixtureOptions = {}) {
  const host = testAdapters({ ...options, initialSettings: initial });
  return {
    store: host.store,
    notices: host.notifier,
    log: host.logger,
    clipboard: host.clipboard,
    failClipboard: host.failClipboard,
    layer: appServicesLayer(host.adapters, {
      language: options.language ?? "de",
      developmentMode: options.developmentMode ?? false,
    }),
  };
}

export function recordingEventBus() {
  const events: AppEvent[] = [];
  let failPublication = false;
  const layer = Layer.effect(
    EventBus,
    Effect.map(EventBus, (bus) => ({
      subscribe: bus.subscribe,
      publish: (event) =>
        Effect.suspend(() => {
          if (failPublication) {
            failPublication = false;
            return Effect.die(new Error("Event publication failed"));
          }
          return Effect.tap(bus.publish(event), () =>
            Effect.sync(() => {
              events.push(event);
            }),
          );
        }),
    })),
  ).pipe(Layer.provide(EventBusLive));
  return {
    layer,
    events,
    failNextPublish: () => {
      failPublication = true;
    },
  };
}

export function controllableRead(initial: number | "fail") {
  let value = initial;
  let paused = false;
  const waiters = new Set<() => void>();
  const readValue = Effect.suspend(() =>
    value === "fail" ? Effect.fail(new VaultReadError()) : Effect.succeed(value),
  );
  const wait = Effect.promise(
    (signal) =>
      new Promise<void>((resolve) => {
        const settle = () => {
          waiters.delete(settle);
          signal.removeEventListener("abort", settle);
          resolve();
        };
        waiters.add(settle);
        signal.addEventListener("abort", settle, { once: true });
      }),
  );
  return {
    read: Effect.suspend(() => (paused ? Effect.andThen(wait, readValue) : readValue)),
    hold: () => {
      paused = true;
    },
    release: () => {
      paused = false;
      for (const settle of waiters) settle();
    },
    held: () => waiters.size,
    set: (next: number | "fail") => {
      value = next;
    },
  };
}
