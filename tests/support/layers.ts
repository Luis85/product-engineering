import { Effect, Layer } from "effect";
import { messagesLayer } from "../../src/application/messages";
import {
  Clipboard,
  ClipboardError,
  HostInfo,
  Incidents,
  LoggerLive,
  LogSink,
  Notifier,
  SettingsServiceLive,
  SettingsStore,
  StorageError,
} from "../../src/application/shell";
import type { DatedLogEntry, Language, UserMessage } from "../../src/application/shell";

type StoreOptions = { readonly uncancellableSaves?: boolean };

function inMemoryStore(initial?: unknown, { uncancellableSaves = false }: StoreOptions = {}) {
  let data = initial;
  let failLoad = false;
  let failSave = false;
  let pauseSaves = false;
  const saved: unknown[] = [];
  const heldSaves: (() => void)[] = [];
  const saveWaiters: (() => void)[] = [];

  const write = (next: unknown) => {
    data = next;
    saved.push(next);
  };
  const save = (next: unknown) =>
    Effect.suspend(() => {
      if (failSave) return Effect.fail(new StorageError());
      if (!pauseSaves) return Effect.sync(() => write(next));
      return Effect.promise(
        (signal) =>
          new Promise<void>((resolve) => {
            heldSaves.push(() => {
              if (uncancellableSaves || !signal.aborted) write(next);
              resolve();
            });
            for (const notify of saveWaiters.splice(0)) notify();
          }),
      );
    });
  const waitForHeldSave = Effect.promise(
    () =>
      new Promise<void>((resolve) => {
        if (heldSaves.length > 0) resolve();
        else saveWaiters.push(resolve);
      }),
  );
  const layer = Layer.succeed(SettingsStore, {
    load: Effect.suspend(() => (failLoad ? Effect.fail(new StorageError()) : Effect.succeed(data))),
    save,
  });

  return {
    layer,
    saved,
    heldSaves,
    waitForHeldSave,
    setFailLoad: (value: boolean) => {
      failLoad = value;
    },
    setFailSave: (value: boolean) => {
      failSave = value;
    },
    holdSaves: () => {
      pauseSaves = true;
    },
    releaseSaves: () => {
      pauseSaves = false;
      for (const release of heldSaves.splice(0)) release();
    },
    writeExternally: (next: unknown) => {
      data = next;
    },
  };
}

type SettingsFixtureOptions = StoreOptions & { readonly language?: Language };

export function settingsFixture(initial?: unknown, options: SettingsFixtureOptions = {}) {
  const store = inMemoryStore(initial, options);
  const notices: UserMessage[] = [];
  const ports = Layer.mergeAll(
    store.layer,
    messagesLayer(options.language ?? "de"),
    Layer.succeed(Notifier, {
      notify: (message) =>
        Effect.sync(() => {
          notices.push(message);
        }),
    }),
  );
  return { store, notices, layer: Layer.provideMerge(SettingsServiceLive, ports) };
}

type ShellFixtureOptions = SettingsFixtureOptions & { readonly developmentMode?: boolean };

export function shellFixture(initial?: unknown, options: ShellFixtureOptions = {}) {
  const settings = settingsFixture(initial, options);
  const log: DatedLogEntry[] = [];
  const clipboard: string[] = [];
  let incident = 0;
  let clipboardFailed = false;
  const ports = Layer.mergeAll(
    settings.layer,
    Layer.succeed(HostInfo, {
      pluginVersion: "0.1.0",
      apiVersion: "1.15.1",
      platform: "Windows",
    }),
    Layer.succeed(Incidents, { nextId: Effect.sync(() => `T-${++incident}`) }),
    Layer.succeed(LogSink, {
      write: (entry) =>
        Effect.sync(() => {
          log.push(entry);
        }),
    }),
    Layer.succeed(Clipboard, {
      write: (text) =>
        Effect.suspend(() => {
          if (clipboardFailed) return Effect.fail(new ClipboardError());
          return Effect.sync(() => {
            clipboard.push(text);
          });
        }),
    }),
  );
  return {
    ...settings,
    log,
    clipboard,
    failClipboard: () => {
      clipboardFailed = true;
    },
    layer: Layer.provideMerge(
      LoggerLive({ developmentMode: options.developmentMode ?? false }),
      ports,
    ),
  };
}
