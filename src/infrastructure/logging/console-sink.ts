import { Effect, Layer } from "effect";
import { LogSink } from "../../application/shell";
import type { DatedLogEntry } from "../../application/shell";

const prefix = "[product-engineering]";

function writeToConsole(entry: DatedLogEntry): void {
  switch (entry.level) {
    case "error":
      console.error(prefix, entry);
      break;
    case "warn":
      console.warn(prefix, entry);
      break;
    case "info":
    case "debug":
      console.debug(prefix, entry);
      break;
  }
}

export const consoleSinkLayer = Layer.succeed(LogSink, {
  write: (entry) => Effect.sync(() => writeToConsole(entry)),
});
