import { Effect } from "effect";
import type { Plugin } from "obsidian";
import type { AppRuntime } from "../../../application/app-services";
import type { AppCommand } from "../../../application/commands";
import type { Catalog } from "../../../application/messages";
import { runSafely } from "./run";

export function registerCommands(
  plugin: Plugin,
  runtime: AppRuntime,
  commands: readonly AppCommand[],
  messages: Catalog,
  open: (route?: never) => Promise<unknown>,
): () => void {
  const registered: string[] = [];

  const undo = (): void => {
    let firstFailure: { cause: unknown } | undefined;
    for (const id of registered.splice(0).toReversed()) {
      try {
        plugin.removeCommand(id);
      } catch (cause) {
        firstFailure ??= { cause };
      }
    }
    if (firstFailure) throw firstFailure.cause;
  };

  try {
    for (const { id, name, action } of commands) {
      const localizedName = name(messages);
      const effect =
        action._tag === "open" ? Effect.promise(() => open(action.route)) : action.effect;
      // The host can throw after inserting a command.
      registered.push(id);
      plugin.addCommand({
        id,
        name: localizedName,
        callback: () => {
          void runSafely(runtime, effect);
        },
      });
    }
  } catch (cause) {
    try {
      undo();
    } catch {
      // Preserve the registration failure after attempting every removal.
    }
    throw cause;
  }
  return undo;
}
