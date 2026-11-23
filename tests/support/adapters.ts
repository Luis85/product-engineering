import { Effect, Layer } from "effect";
import type { AppAdapters } from "../../src/application/app-services-layer";
import {
  Clipboard,
  ClipboardError,
  HostInfo,
  Incidents,
  LogSink,
  Notifier,
  SettingsStore,
  StorageError,
} from "../../src/application/shell";
import type { DatedLogEntry, UserMessage } from "../../src/application/shell";
import { memoryNoteStore, sequentialIdGenerator } from "../../src/infrastructure/memory/notes";
import { memoryProjectFiles } from "../../src/infrastructure/memory/projects";

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

export type TestAdapterOptions = StoreOptions & {
  readonly initialSettings?: unknown;
  readonly artifactGit?: AppAdapters["artifactGit"];
  readonly hostEvents?: AppAdapters["hostEvents"];
};

const testHostInfo = Layer.succeed(HostInfo, {
  pluginVersion: "0.1.0",
  apiVersion: "1.15.1",
  platform: "Windows",
});

export function testAdapters(options: TestAdapterOptions = {}) {
  const store = inMemoryStore(options.initialSettings, options);
  const notes = memoryNoteStore();
  const projectFiles = memoryProjectFiles(notes.occupied, notes.isFolder);
  const notifier: UserMessage[] = [];
  const logger: DatedLogEntry[] = [];
  const clipboard: string[] = [];
  let incident = 0;
  let clipboardFailed = false;

  const adapters: AppAdapters = {
    ...(options.artifactGit ? { artifactGit: options.artifactGit } : {}),
    settingsStore: store.layer,
    notifier: Layer.succeed(Notifier, {
      notify: (message) =>
        Effect.sync(() => {
          notifier.push(message);
        }),
    }),
    clipboard: Layer.succeed(Clipboard, {
      write: (text) =>
        Effect.suspend(() => {
          if (clipboardFailed) return Effect.fail(new ClipboardError());
          return Effect.sync(() => {
            clipboard.push(text);
          });
        }),
    }),
    logSink: Layer.succeed(LogSink, {
      write: (entry) =>
        Effect.sync(() => {
          logger.push(entry);
        }),
    }),
    hostInfo: testHostInfo,
    incidents: Layer.succeed(Incidents, { nextId: Effect.sync(() => `T-${++incident}`) }),
    hostEvents: options.hostEvents ?? Layer.empty,
    noteStore: notes.layer,
    noteOpener: notes.opener,
    idGenerator: sequentialIdGenerator(),
    projectFiles: projectFiles.layer,
  };
  return {
    adapters,
    store,
    notes,
    projectFiles,
    notifier,
    clipboard,
    logger,
    failClipboard: () => {
      clipboardFailed = true;
    },
  };
}
