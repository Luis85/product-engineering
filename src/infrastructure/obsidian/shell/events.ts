import { Effect, Exit, Layer } from "effect";
import type { Plugin } from "obsidian";
import { EventBus, reportUnexpected } from "../../../application/shell";
import type { ShellServices } from "../../../application/shell";

export function hostEventsLayer(plugin: Plugin): Layer.Layer<never, never, ShellServices> {
  return Layer.effectDiscard(
    Effect.gen(function* () {
      const bus = yield* EventBus;
      const context = yield* Effect.context<ShellServices>();
      const run = Effect.runSyncExitWith(context);
      let open = true;
      let published = false;

      const close = () => {
        open = false;
      };
      yield* Effect.addFinalizer(() => Effect.sync(close));

      yield* Effect.sync(() => {
        plugin.register(close);
        plugin.app.workspace.onLayoutReady(() => {
          if (!open || published) return;
          published = true;
          const result = run(Effect.suspend(() => bus.publish({ _tag: "LayoutReady" })));
          if (Exit.isFailure(result)) run(reportUnexpected(result.cause));
        });
      });
    }),
  );
}
