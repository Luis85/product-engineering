import { Effect, Exit, Layer } from "effect";
import { TFile } from "obsidian";
import type { App, Plugin, TAbstractFile } from "obsidian";
import type { AppEvent } from "../../../application/events";
import { EventBus, reportUnexpected } from "../../../application/shell";
import type { ShellServices } from "../../../application/shell";

export function hostEventsLayer(plugin: Plugin): Layer.Layer<never, never, ShellServices> {
  return Layer.effectDiscard(
    Effect.gen(function* () {
      const bus = yield* EventBus;
      const context = yield* Effect.context<ShellServices>();
      const run = Effect.runSyncExitWith(context);
      let open = true;
      let ready = false;
      let release: (() => void) | undefined;

      const close = () => {
        if (!open) return;
        open = false;
        release?.();
      };
      const publish = (event: () => AppEvent | undefined) => {
        if (!open) return;
        const result = run(
          Effect.suspend(() => {
            const value = event();
            return value === undefined ? Effect.void : bus.publish(value);
          }),
        );
        if (Exit.isFailure(result)) run(reportUnexpected(result.cause));
      };
      yield* Effect.addFinalizer(() => Effect.sync(close));

      yield* Effect.sync(() => {
        plugin.register(close);
        plugin.app.workspace.onLayoutReady(() => {
          if (!open || ready) return;
          ready = true;
          publish(() => ({ _tag: "LayoutReady" }));
          if (open) release = listenForFiles(plugin.app, publish);
        });
      });
    }),
  );
}

function listenForFiles(
  app: App,
  publish: (event: () => AppEvent | undefined) => void,
): () => void {
  const { vault, metadataCache } = app;
  const fileEvent =
    (_tag: "FileCreated" | "FileDeleted" | "FileModified" | "MetadataChanged") =>
    (file: TAbstractFile) =>
      publish(() =>
        file instanceof TFile ? { _tag, path: file.path, extension: file.extension } : undefined,
      );
  const refs = [
    vault.on("create", fileEvent("FileCreated")),
    vault.on("modify", fileEvent("FileModified")),
    vault.on("delete", fileEvent("FileDeleted")),
    vault.on("rename", (file, oldPath) =>
      publish(() =>
        file instanceof TFile
          ? { _tag: "FileRenamed", path: file.path, extension: file.extension, oldPath }
          : undefined,
      ),
    ),
  ];
  const changed = metadataCache.on("changed", fileEvent("MetadataChanged"));
  return () => {
    for (const ref of refs) vault.offref(ref);
    metadataCache.offref(changed);
  };
}
