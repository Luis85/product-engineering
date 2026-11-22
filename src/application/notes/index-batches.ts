import { Clock, Effect, Option, Queue } from "effect";
import type { Deferred } from "effect";
import type { AppEvent } from "../events";

export const INDEX_BATCH_QUIET = 100;
export const INDEX_BATCH_MAX = 1000;

type Paths = { readonly kind: "paths"; readonly paths: readonly string[]; readonly at: number };
export type IndexCommand =
  | Paths
  | { readonly kind: "ready" }
  | { readonly kind: "rebuild"; readonly done?: Deferred.Deferred<void> };

export function eventPaths(event: AppEvent): readonly string[] {
  if (event._tag === "FileRenamed") {
    return event.extension.toLowerCase() === "md" || /\.md$/i.test(event.oldPath)
      ? [event.oldPath, event.path]
      : [];
  }
  if (event._tag !== "MetadataChanged" && event._tag !== "FileDeleted") return [];
  return event.extension.toLowerCase() === "md" ? [event.path] : [];
}

function peekBefore(queue: Queue.Queue<IndexCommand>, deadline: number) {
  return Effect.gen(function* () {
    const wait = deadline - (yield* Clock.currentTimeMillis);
    if (wait > 0) return yield* Queue.peek(queue).pipe(Effect.timeoutOption(wait));
    const queued = yield* Queue.size(queue);
    return queued > 0 ? Option.some(yield* Queue.peek(queue)) : Option.none<IndexCommand>();
  });
}

export function collectBatch(queue: Queue.Queue<IndexCommand>, first: Paths) {
  return Effect.gen(function* () {
    const paths = new Set(first.paths);
    const maxEnd = first.at + INDEX_BATCH_MAX;
    let lastAt = first.at;

    while (true) {
      const end = Math.min(maxEnd, lastAt + INDEX_BATCH_QUIET);
      // Peeking leaves the command available if the batch deadline wins the race.
      const next = yield* peekBefore(queue, end);
      if (Option.isNone(next) || next.value.kind !== "paths" || next.value.at >= end) return paths;
      yield* Queue.take(queue);
      for (const path of next.value.paths) paths.add(path);
      lastAt = next.value.at;
    }
  });
}
