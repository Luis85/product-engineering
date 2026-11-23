import { Effect, Layer } from "effect";
import { appServicesLayer } from "../src/application/app-services-layer";
import { NoteStore } from "../src/application/notes";
import {
  Clipboard,
  ClipboardError,
  EventBus,
  HostInfo,
  Notifier,
  SettingsStore,
  StorageError,
  VaultReadError,
} from "../src/application/shell";
import type { Language, UserMessage } from "../src/application/shell";
import type { Frontmatter } from "../src/domain/notes";
import { DEFAULT_SETTINGS } from "../src/domain/shell";
import { consoleSinkLayer } from "../src/infrastructure/logging/console-sink";
import { incidentsLayer } from "../src/infrastructure/logging/incidents";
import { memoryNoteStore, sequentialIdGenerator } from "../src/infrastructure/memory/notes";
import { memoryProjectFiles } from "../src/infrastructure/memory/projects";

export const SCENARIOS = ["loaded", "empty", "invalid", "readonly", "failure"] as const;
type Scenario = (typeof SCENARIOS)[number];

type ScenarioNote = readonly [path: string, data: Frontmatter | "broken"];
const itemsFolder = DEFAULT_SETTINGS.rootFolder + "/Items/";

function item(
  sequence: number,
  name: string,
  title: string,
  status: string,
  version = 1,
): ScenarioNote {
  return [
    itemsFolder + name + ".md",
    {
      schema: "product-engineering.item/v" + version,
      id: "item-33333333-3333-4333-8333-" + String(sequence).padStart(12, "0"),
      title,
      status,
    },
  ];
}

const normal = item(1, "Plan the release", "Plan the release", "open");
const sampleNotes = {
  loaded: [normal, item(2, "Review documentation", "Review documentation", "done")],
  empty: [],
  invalid: [
    item(3, "Broken status", "Broken status", "blocked"),
    item(4, "Duplicate one", "Repeated title", "open"),
    item(5, "Duplicate two", "Repeated title", "done"),
    [itemsFolder + "Unreadable.md", "broken"],
    ["Outside/Malformed marker.md", { schema: "product-engineering.broken" }],
  ],
  readonly: [normal, item(6, "Next version", "Next version", "open", 2)],
  failure: [normal],
} satisfies Record<Scenario, readonly ScenarioNote[]>;

function failFirstIndexRead(source: Layer.Layer<NoteStore>) {
  return Layer.effect(
    NoteStore,
    Effect.map(NoteStore, (store) => {
      let first = true;
      const list = Effect.suspend(() => {
        if (!first) return store.list;
        first = false;
        return Effect.fail(new VaultReadError());
      });
      return { ...store, list };
    }),
  ).pipe(Layer.provide(source));
}

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
      noteStore: scenario === "failure" ? failFirstIndexRead(notes.layer) : notes.layer,
      noteOpener: notes.opener,
      idGenerator: sequentialIdGenerator(),
      projectFiles: memoryProjectFiles(notes.occupied).layer,
      hostEvents: Layer.effectDiscard(
        Effect.gen(function* () {
          const events = yield* EventBus;
          yield* Effect.forEach(sampleNotes[scenario], ([path, data]) => notes.seed(path, data), {
            discard: true,
          });
          yield* events.publish({ _tag: "LayoutReady" });
          yield* events.publish({ _tag: "VaultReady" });
        }),
      ),
    },
    { language, developmentMode: true },
  );
}
