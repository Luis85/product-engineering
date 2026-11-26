import { Clock, Effect, Layer, Ref } from "effect";
import { LOG_LEVELS } from "../../domain/shell";
import { Logger, LogSink } from "./ports";
import type { DatedLogEntry, LogEntry } from "./ports";
import { SettingsService } from "./settings-service";

export function LoggerLive({ developmentMode }: { readonly developmentMode: boolean }) {
  return Layer.effect(
    Logger,
    Effect.gen(function* () {
      const settings = yield* SettingsService;
      const sink = yield* LogSink;
      const entries = yield* Ref.make<readonly DatedLogEntry[]>([]);

      const log = (entry: LogEntry) =>
        Effect.gen(function* () {
          const { logLevel } = yield* settings.current;
          if (!developmentMode && LOG_LEVELS.indexOf(entry.level) > LOG_LEVELS.indexOf(logLevel))
            return;
          const record = { ...entry, timestamp: yield* Clock.currentTimeMillis };
          yield* Ref.update(entries, (previous) => [...previous.slice(-49), record]);
          yield* sink.write(record);
        });

      return { log, recent: Ref.get(entries) };
    }),
  );
}
