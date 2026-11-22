import { Effect, Layer } from "effect";
import { appServicesLayer } from "../src/application/app-services-layer";
import {
  Clipboard,
  ClipboardError,
  EventBus,
  HostInfo,
  Notifier,
  SettingsStore,
  StorageError,
} from "../src/application/shell";
import type { Language, UserMessage } from "../src/application/shell";
import { consoleSinkLayer } from "../src/infrastructure/logging/console-sink";
import { incidentsLayer } from "../src/infrastructure/logging/incidents";
import { memoryNoteStore, sequentialIdGenerator } from "../src/infrastructure/memory/notes";

export const SCENARIOS = ["loaded", "empty", "invalid", "readonly", "failure"] as const;
type Scenario = (typeof SCENARIOS)[number];

export function parseScenario(value: unknown): Scenario {
  return SCENARIOS.find((scenario) => scenario === value) ?? SCENARIOS[0];
}

function initialSettings(scenario: Scenario): unknown {
  switch (scenario) {
    case "loaded":
      return { schemaVersion: 1, logLevel: "info" };
    case "invalid":
      return { schemaVersion: 1, logLevel: "verbose" };
    case "readonly":
      return { schemaVersion: 2, logLevel: "error" };
    case "empty":
    case "failure":
      return null;
  }
}

type HarnessOptions = {
  readonly language: Language;
  readonly notify: (message: UserMessage) => void;
};

export function harnessLayer(scenario: Scenario, { language, notify }: HarnessOptions) {
  let stored = initialSettings(scenario);
  const notes = memoryNoteStore();
  const settingsStore = Layer.succeed(SettingsStore, {
    load: scenario === "failure" ? Effect.fail(new StorageError()) : Effect.sync(() => stored),
    save: (data) =>
      Effect.sync(() => {
        stored = data;
      }),
  });

  return appServicesLayer(
    {
      settingsStore,
      notifier: Layer.succeed(Notifier, {
        notify: (message) => Effect.sync(() => notify(message)),
      }),
      clipboard: Layer.succeed(Clipboard, {
        write: (text) =>
          Effect.tryPromise({
            try: () => navigator.clipboard.writeText(text),
            catch: (cause) => new ClipboardError({ cause }),
          }),
      }),
      hostInfo: Layer.succeed(HostInfo, {
        pluginVersion: "harness",
        apiVersion: "none",
        platform: "browser",
      }),
      incidents: incidentsLayer,
      logSink: consoleSinkLayer,
      noteStore: notes.layer,
      noteOpener: notes.opener,
      idGenerator: sequentialIdGenerator(),
      hostEvents: Layer.effectDiscard(
        EventBus.use((events) => events.publish({ _tag: "LayoutReady" })),
      ),
    },
    { language, developmentMode: true },
  );
}
