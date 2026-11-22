import { Effect, Stream } from "effect";
import type { AppRuntime } from "../../../application/app-services";
import { SettingsService } from "../../../application/shell";
import type { SettingsStatus } from "../../../application/shell";
import type { Settings } from "../../../domain/shell";

export interface SettingsMirror {
  readonly current: Settings;
  readonly status: SettingsStatus;
  refresh(): Promise<void>;
  stop(): Promise<void>;
}

export async function mirrorSettings(runtime: AppRuntime): Promise<SettingsMirror> {
  const read = Effect.flatMap(SettingsService, ({ current, status }) =>
    Effect.all({ current, status }),
  );
  let snapshot = await runtime.runPromise(read);
  const observer = new AbortController();

  const refresh = Effect.flatMap(read, (next) =>
    Effect.sync(() => {
      if (!observer.signal.aborted) snapshot = next;
    }),
  );
  const observe = Effect.flatMap(SettingsService, ({ changes, statusChanges }) =>
    Stream.runForEach(Stream.merge(changes, statusChanges), () => refresh),
  );
  const updating = runtime.runPromiseExit(observe, { signal: observer.signal });

  return {
    get current() {
      return snapshot.current;
    },
    get status() {
      return snapshot.status;
    },
    async refresh() {
      if (!observer.signal.aborted) await runtime.runPromise(refresh);
    },
    async stop() {
      observer.abort();
      await updating;
    },
  };
}
