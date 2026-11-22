import { Context, Effect, Layer, Semaphore, SubscriptionRef } from "effect";
import type { Stream } from "effect";
import {
  decodeSettings,
  DEFAULT_SETTINGS,
  encodeSettings,
  validatePatch,
} from "../../domain/shell";
import type { ReadOnlyReason, Settings, SettingsIssue } from "../../domain/shell";
import { InvalidSettingsError, ReadOnlySettingsError } from "./errors";
import type { StorageError } from "./errors";
import { describeSettingsStatus } from "./i18n/describe";
import { Messages, Notifier, SettingsStore } from "./ports";

export type SettingsStatus = {
  readonly writable: boolean;
  readonly issues: readonly SettingsIssue[];
  readonly readOnlyReason?: ReadOnlyReason;
};

export class SettingsService extends Context.Service<
  SettingsService,
  {
    readonly current: Effect.Effect<Settings>;
    readonly status: Effect.Effect<SettingsStatus>;
    readonly changes: Stream.Stream<Settings>;
    readonly statusChanges: Stream.Stream<SettingsStatus>;
    readonly update: (
      patch: unknown,
    ) => Effect.Effect<void, StorageError | ReadOnlySettingsError | InvalidSettingsError>;
    readonly reload: Effect.Effect<void>;
  }
>()("product-engineering/application/SettingsService") {}

function statusOf({ issues, readOnlyReason }: ReturnType<typeof decodeSettings>): SettingsStatus {
  return {
    issues,
    writable: readOnlyReason === undefined,
    ...(readOnlyReason === undefined ? {} : { readOnlyReason }),
  };
}

function readFailure(): ReturnType<typeof decodeSettings> {
  return {
    settings: DEFAULT_SETTINGS,
    issues: [{ code: "file.invalid" }],
    readOnlyReason: "unreadable",
  };
}

function publish<A>(ref: SubscriptionRef.SubscriptionRef<A>, value: A) {
  return Effect.gen(function* () {
    const previous = yield* SubscriptionRef.get(ref);
    if (JSON.stringify(previous) === JSON.stringify(value)) return false;
    yield* SubscriptionRef.set(ref, value);
    return true;
  });
}

export const SettingsServiceLive = Layer.effect(
  SettingsService,
  Effect.gen(function* () {
    const store = yield* SettingsStore;
    const notifier = yield* Notifier;
    const { shell: messages } = yield* Messages;

    const read = Effect.match(store.load, { onFailure: readFailure, onSuccess: decodeSettings });
    const initial = yield* read;
    const settings = yield* SubscriptionRef.make(initial.settings);
    const status = yield* SubscriptionRef.make(statusOf(initial));
    const lock = yield* Semaphore.make(1);
    const notify = (value: SettingsStatus) => {
      const message = describeSettingsStatus(value, messages);
      return message ? notifier.notify(message) : Effect.void;
    };
    yield* notify(statusOf(initial));

    const reload = Semaphore.withPermit(lock)(
      Effect.gen(function* () {
        const next = yield* read;
        const nextStatus = statusOf(next);
        yield* publish(settings, next.settings);
        const statusChanged = yield* publish(status, nextStatus);
        if (statusChanged) yield* notify(nextStatus);
      }),
    );

    const update = (input: unknown) =>
      Semaphore.withPermit(lock)(
        Effect.gen(function* () {
          const state = yield* SubscriptionRef.get(status);
          if (state.readOnlyReason) {
            return yield* new ReadOnlySettingsError({ reason: state.readOnlyReason });
          }
          const { patch, issues } = validatePatch(input);
          if (issues.length) return yield* new InvalidSettingsError({ issues });

          const current = yield* SubscriptionRef.get(settings);
          const next = { ...current, ...patch };
          yield* Effect.uninterruptible(
            Effect.gen(function* () {
              yield* store.save(encodeSettings(next));
              yield* publish(settings, next);
              yield* publish(status, { writable: true, issues: [] });
            }),
          );
        }),
      );

    return {
      current: SubscriptionRef.get(settings),
      status: SubscriptionRef.get(status),
      changes: SubscriptionRef.changes(settings),
      statusChanges: SubscriptionRef.changes(status),
      update,
      reload,
    };
  }),
);
