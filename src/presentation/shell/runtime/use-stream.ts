import { Effect, Exit, Stream } from "effect";
import { computed, onScopeDispose, shallowRef } from "vue";
import type { AppServices } from "../../../application/app-services";
import { SettingsService } from "../../../application/shell";
import { runRuntimeExit, useRuntimeContext } from "./use-runtime";

export function useStream<A, E>(
  read: Effect.Effect<A, never, AppServices>,
  changes: Stream.Stream<A, E, AppServices>,
) {
  const { runtime, report } = useRuntimeContext();
  const value = shallowRef({ current: runtime.runSync(read) });
  const controller = new AbortController();
  onScopeDispose(() => controller.abort());

  const follow = Stream.runForEach(changes, (current) =>
    Effect.sync(() => {
      if (!controller.signal.aborted) value.value = { current };
    }),
  );
  void runRuntimeExit(runtime, follow, controller.signal).then((exit) => {
    if (Exit.isFailure(exit)) return report(exit.cause);
  });
  return computed(() => value.value.current);
}

export function useSettings() {
  return useStream(
    SettingsService.use((settings) => settings.current),
    Stream.unwrap(SettingsService.use((settings) => Effect.succeed(settings.changes))),
  );
}

export function useAsyncStream<A, E>(initial: A, changes: Stream.Stream<A, E, AppServices>) {
  return useStream(Effect.succeed(initial), changes);
}

export function useSettingsStatus() {
  return useStream(
    SettingsService.use((settings) => settings.status),
    Stream.unwrap(SettingsService.use((settings) => Effect.succeed(settings.statusChanges))),
  );
}
