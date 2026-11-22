import { Clock, Deferred, Effect, Layer, Queue, Stream, SubscriptionRef } from "effect";
import { clashKey, isRecordFrontmatter } from "../../domain/notes";
import type { NoteFields, NoteType } from "../../domain/notes";
import type { AppEvent } from "../events";
import { EventBus, Logger, reportDefect, SettingsService } from "../shell";
import { NoteIndexReadError } from "./errors";
import { collectBatch, eventPaths } from "./index-batches";
import type { IndexCommand } from "./index-batches";
import { buildIndexState, createIndexState, updateIndexState } from "./index-state";
import type { IndexState } from "./index-state";
import { NoteIndex } from "./note-index";
import type { IndexedNote, NoteIndexSnapshot } from "./note-index";
import { NoteStore } from "./ports";
import type { Note } from "./ports";

type Status = Pick<NoteIndexSnapshot<never>, "ready" | "failure">;

function snapshotRef<Row>(notes: readonly Row[]) {
  return SubscriptionRef.make<NoteIndexSnapshot<Row>>({ ready: false, failure: undefined, notes });
}

function publish<Row>(
  ref: SubscriptionRef.SubscriptionRef<NoteIndexSnapshot<Row>>,
  status: Status,
  notes: readonly Row[],
) {
  return Effect.flatMap(SubscriptionRef.get(ref), (before) =>
    before.ready === status.ready && before.failure === status.failure && before.notes === notes
      ? Effect.void
      : SubscriptionRef.set(ref, { ...status, notes }),
  );
}

function makeSnapshots(initial: IndexState) {
  return Effect.gen(function* () {
    const byType = new Map(
      yield* Effect.forEach(initial.byType, ([type, notes]) =>
        Effect.map(snapshotRef(notes), (ref) => [type, ref] as const),
      ),
    );
    const unindexed = yield* snapshotRef(initial.unindexed);

    function registered<Fields extends NoteFields>(type: NoteType<Fields>) {
      const ref = byType.get(type);
      if (!ref) throw new Error("Unregistered note type");
      return ref as SubscriptionRef.SubscriptionRef<NoteIndexSnapshot<IndexedNote<Fields>>>;
    }

    return {
      publish: (state: IndexState, status: Status) =>
        Effect.gen(function* () {
          for (const [type, notes] of state.byType) yield* publish(registered(type), status, notes);
          yield* publish(unindexed, status, state.unindexed);
        }),
      noteSnapshot: <Fields extends NoteFields>(type: NoteType<Fields>) =>
        Effect.suspend(() => SubscriptionRef.get(registered(type))),
      noteChanges: <Fields extends NoteFields>(type: NoteType<Fields>) =>
        Stream.suspend(() => SubscriptionRef.changes(registered(type))),
      unindexedSnapshot: SubscriptionRef.get(unindexed),
      unindexedChanges: SubscriptionRef.changes(unindexed),
    };
  });
}

function reRead(store: NoteStore["Service"], paths: ReadonlySet<string>, rootFolder: string) {
  return Effect.gen(function* () {
    const rereads = new Map<string, Note | undefined>();
    const root = clashKey(rootFolder) + "/";
    let checkUnreadable = false;
    for (const path of paths) {
      const note = yield* Effect.catchTag(store.read(path), "NoteNotFoundError", () =>
        Effect.succeed(undefined),
      );
      rereads.set(path, note);
      if (
        note !== undefined &&
        !isRecordFrontmatter(note.frontmatter) &&
        clashKey(path).startsWith(root)
      ) {
        checkUnreadable = true;
      }
    }
    const unreadable = checkUnreadable ? yield* store.unreadable(rootFolder) : undefined;
    return { rereads, unreadable };
  });
}

function indexWorker(
  initial: IndexState,
  snapshots: Effect.Success<ReturnType<typeof makeSnapshots>>,
) {
  return Effect.gen(function* () {
    const store = yield* NoteStore;
    const settings = yield* SettingsService;
    const logger = yield* Logger;
    let state = initial;
    let status: Status = { ready: false, failure: undefined };

    function recordFailure(
      event: "notes.index.build.failed" | "notes.index.read.failed",
      paths: number,
    ) {
      return Effect.gen(function* () {
        status = { ...status, failure: status.failure ?? new NoteIndexReadError() };
        yield* logger.log({ level: "warn", event, data: { paths } });
        yield* snapshots.publish(state, status);
      });
    }

    const build = Effect.gen(function* () {
      const { rootFolder } = yield* settings.current;
      const notes = yield* store.list;
      const unreadable = yield* store.unreadable(rootFolder);
      state = buildIndexState(state, notes, unreadable);
      status = { ready: true, failure: undefined };
      yield* logger.log({
        level: "info",
        event: "notes.index.built",
        data: { notes: notes.length, unreadable: unreadable.length },
      });
      yield* snapshots.publish(state, status);
    }).pipe(Effect.catch(() => recordFailure("notes.index.build.failed", 0)));

    function follow(paths: ReadonlySet<string>) {
      return Effect.gen(function* () {
        const { rootFolder } = yield* settings.current;
        const { rereads, unreadable } = yield* reRead(store, paths, rootFolder);
        if (!status.ready) return;
        state = updateIndexState(state, rereads, unreadable);
        yield* snapshots.publish(state, status);
      }).pipe(Effect.catch(() => recordFailure("notes.index.read.failed", paths.size)));
    }

    return { build, follow };
  });
}

function protect(effect: Effect.Effect<void>) {
  return Effect.catchDefect(effect, (defect) => Effect.asVoid(reportDefect(defect)));
}

function startIndex(worker: Effect.Success<ReturnType<typeof indexWorker>>) {
  return Effect.gen(function* () {
    const bus = yield* EventBus;
    const settings = yield* SettingsService;
    const events = yield* bus.subscribe;
    const queue = yield* Effect.acquireRelease(Queue.unbounded<IndexCommand>(), Queue.shutdown);
    const firstBuild = yield* Deferred.make<void>();
    const stopped = yield* Deferred.make<void>();
    let accepting = false;
    let started = false;
    let live = true;

    const enqueue = (command: IndexCommand) => Effect.asVoid(Queue.offer(queue, command));
    const ready = Effect.suspend(() => {
      if (accepting) return Effect.void;
      accepting = true;
      return enqueue({ kind: "ready" });
    });

    function observe(event: AppEvent) {
      if (event._tag === "VaultReady") return ready;
      if (!accepting) return Effect.void;
      const paths = eventPaths(event);
      return paths.length === 0
        ? Effect.void
        : Effect.flatMap(Clock.currentTimeMillis, (at) => enqueue({ kind: "paths", paths, at }));
    }

    const processNext = Effect.gen(function* () {
      const command = yield* Queue.take(queue);
      switch (command.kind) {
        case "ready":
          started = true;
          yield* protect(worker.build);
          yield* Deferred.succeed(firstBuild, undefined);
          break;
        case "paths": {
          const paths = yield* collectBatch(queue, command);
          yield* protect(worker.follow(paths));
          break;
        }
        case "rebuild":
          yield* protect(worker.build);
          if (command.done) yield* Deferred.succeed(command.done, undefined);
          break;
      }
    });

    let rootFolder = (yield* settings.current).rootFolder;
    const watchFolder = Stream.runForEach(settings.changes, (setting) => {
      if (setting.rootFolder === rootFolder) return Effect.void;
      rootFolder = setting.rootFolder;
      return accepting ? enqueue({ kind: "rebuild" }) : Effect.void;
    });

    yield* Effect.forkScoped(Effect.forever(processNext), { startImmediately: true });
    yield* Effect.forkScoped(Stream.runForEach(events, observe), { startImmediately: true });
    yield* Effect.forkScoped(watchFolder, { startImmediately: true });
    yield* Effect.addFinalizer(() =>
      Effect.sync(() => {
        live = false;
      }).pipe(Effect.andThen(Deferred.succeed(stopped, undefined)), Effect.asVoid),
    );

    const interrupted = Effect.andThen(Deferred.await(stopped), Effect.interrupt);
    const rebuild = Effect.suspend(() => {
      if (!live) return Effect.void;
      const complete = started
        ? Effect.gen(function* () {
            const done = yield* Deferred.make<void>();
            yield* enqueue({ kind: "rebuild", done });
            yield* Deferred.await(done);
          })
        : Deferred.await(firstBuild);
      return Effect.raceFirst(complete, interrupted);
    });

    return rebuild;
  });
}

export function noteIndexLayer(types: readonly NoteType[]) {
  return Layer.effect(
    NoteIndex,
    Effect.gen(function* () {
      const state = createIndexState(types);
      const snapshots = yield* makeSnapshots(state);
      const worker = yield* indexWorker(state, snapshots);
      const rebuild = yield* startIndex(worker);
      return { ...snapshots, rebuild };
    }),
  );
}
