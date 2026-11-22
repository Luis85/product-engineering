import { Exit } from "effect";
import type { Effect } from "effect";
import type { AppRuntime, AppServices } from "../../../application/app-services";
import { reportUnexpected } from "../../../application/shell";

export async function runSafely<A, E>(
  runtime: AppRuntime,
  effect: Effect.Effect<A, E, AppServices>,
): Promise<A | undefined> {
  try {
    const result = await runtime.runPromiseExit(effect);
    if (Exit.isSuccess(result)) return result.value;
    await runtime.runPromiseExit(reportUnexpected(result.cause));
  } catch {
    // The runtime can close while an Obsidian callback is still in flight.
  }
}
