import { Effect, Layer, Option, Stream } from "effect";
import * as TestClock from "effect/testing/TestClock";
import type { AppEvent } from "../../../src/application/events";
import { messagesLayer } from "../../../src/application/messages";
import { NoteIndex, noteIndexLayer, NoteStore } from "../../../src/application/notes";
import { INDEX_BATCH_QUIET } from "../../../src/application/notes/index-batches";
import type { IndexedNote, NoteIndexSnapshot } from "../../../src/application/notes/note-index";
import {
  EventBus,
  LoggerLive,
  SettingsServiceLive,
  VaultReadError,
} from "../../../src/application/shell";
import type { NoteFields, NoteType } from "../../../src/domain/notes";
import { testAdapters } from "../adapters";
import { recordingEventBus } from "../layers";
import { testNoteType } from "./test-note-type";

const publish = (event: AppEvent) => Effect.flatMap(EventBus, (service) => service.publish(event));
const vaultReady = Effect.andThen(
  publish({ _tag: "LayoutReady" }),
  publish({ _tag: "VaultReady" }),
);

function waitForSnapshot<Fields extends NoteFields>(
  type: NoteType<Fields>,
  predicate: (snapshot: NoteIndexSnapshot<IndexedNote<Fields>>) => boolean,
) {
  return Effect.flatMap(NoteIndex, (index) =>
    index
      .noteChanges(type)
      .pipe(Stream.filter(predicate), Stream.runHead, Effect.map(Option.getOrThrow)),
  );
}

export function countingType<Fields extends NoteFields, Type extends string>(
  declaration: NoteType<Fields, Type>,
) {
  let decodes = 0;
  const type: NoteType<Fields, Type> = {
    ...declaration,
    decode(note) {
      decodes += 1;
      return declaration.decode(note);
    },
  };
  return { type, decodes: () => decodes };
}

export function indexFixture(
  types: readonly NoteType[] = [testNoteType],
  options: { readonly rootFolder?: string } = {},
) {
  const host = testAdapters({ initialSettings: { rootFolder: options.rootFolder ?? "Records" } });
  const bus = recordingEventBus();
  const reads: string[] = [];
  const unreadableScans: string[] = [];
  let listScans = 0;
  let failList = false;
  let dieList = false;
  let failRead = false;
  let failUnreadable = false;
  let beforeList = Effect.void;
  const readFailure = Effect.fail(new VaultReadError());

  const store = Layer.effect(
    NoteStore,
    Effect.map(NoteStore, (original) => ({
      ...original,
      list: Effect.suspend(() => {
        listScans += 1;
        const started = beforeList;
        beforeList = Effect.void;
        return Effect.andThen(
          started,
          Effect.suspend(() => {
            if (dieList) return Effect.die(new Error("Injected list defect"));
            return failList ? readFailure : original.list;
          }),
        );
      }),
      read: (path: string) =>
        Effect.suspend(() => {
          reads.push(path);
          return failRead ? readFailure : original.read(path);
        }),
      unreadable: (folder: string) =>
        Effect.suspend(() => {
          unreadableScans.push(folder);
          return failUnreadable ? readFailure : original.unreadable(folder);
        }),
    })),
  ).pipe(Layer.provide(host.notes.layer));
  const adapters = host.adapters;
  const ports = Layer.mergeAll(
    store,
    bus.layer,
    adapters.settingsStore,
    adapters.notifier,
    adapters.clipboard,
    adapters.hostInfo,
    adapters.incidents,
    adapters.logSink,
    messagesLayer("en"),
  );
  const settings = Layer.provideMerge(SettingsServiceLive, ports);
  const shell = Layer.provideMerge(LoggerLive({ developmentMode: true }), settings);
  const layer = Layer.provideMerge(noteIndexLayer(types), shell);

  return {
    layer,
    notes: host.notes,
    logger: host.logger,
    notifier: host.notifier,
    reads: () => [...reads],
    scans: () => ({ list: listScans, unreadable: [...unreadableScans] }),
    beforeNextList: (hold: Effect.Effect<void>) => {
      beforeList = hold;
    },
    setFailList: (fail: boolean) => {
      failList = fail;
    },
    setDieList: (fail: boolean) => {
      dieList = fail;
    },
    setFailRead: (fail: boolean) => {
      failRead = fail;
    },
    setFailUnreadable: (fail: boolean) => {
      failUnreadable = fail;
    },
    vaultReady,
    advanceBatch: TestClock.adjust(INDEX_BATCH_QUIET),
    publish,
    waitForSnapshot,
  };
}
