import { Effect, Layer } from "effect";
import type { Plugin } from "obsidian";
import type { AppRuntime } from "./application/app-services";
import { appCommands } from "./application/commands";
import { configuredAgentChat } from "./application/integrations";
import { catalogFor } from "./application/messages";
import { noteChanges, noteSnapshot } from "./application/notes";
import type { Route } from "./application/routes";
import {
  describeDefect,
  Incidents,
  Logger,
  LogSink,
  Messages,
  reportDefect,
  SettingsService,
  toLoggedError,
} from "./application/shell";
import { itemType } from "./domain/items";
import { consoleSinkLayer } from "./infrastructure/logging/console-sink";
import { incidentsLayer } from "./infrastructure/logging/incidents";
import { createMcpController } from "./infrastructure/mcp";
import { appLayer } from "./infrastructure/obsidian/app-layer";
import {
  createAgentSettingsPart,
  createMcpItemAccess,
} from "./infrastructure/obsidian/integrations";
import {
  addRibbonIcon,
  hostLanguage,
  mirrorSettings,
  openRoute,
  registerCommands,
  runSafely,
  SHELL_VIEW_TYPE,
  ShellSettingTab,
  ShellView,
  showNotice,
} from "./infrastructure/obsidian/shell";
import { makeRuntime } from "./infrastructure/runtime";
import { appSurface } from "./presentation/app-surface";
import { releaseAll } from "./presentation/shell/host";

type Release = () => void | Promise<void>;

export interface BootstrapHandle {
  readonly runtime: AppRuntime;
  readonly reloadSettings: () => Promise<void>;
  readonly dispose: () => Promise<void>;
}

async function runUndo(steps: readonly Release[]): Promise<void> {
  const failures: unknown[] = [];
  for (const release of steps) {
    try {
      // oxlint-disable-next-line eslint/no-await-in-loop -- Teardown follows dependency order.
      await release();
    } catch (cause) {
      failures.push(cause);
    }
  }
  if (failures.length > 0) throw failures[0];
}

export function reportUnloadFailure(cause: unknown): void {
  try {
    const incident = Effect.runSync(
      Effect.gen(function* () {
        const incidents = yield* Incidents;
        const sink = yield* LogSink;
        const incidentId = yield* incidents.nextId;
        yield* sink.write({
          level: "error",
          event: "plugin.unload.failed",
          timestamp: Date.now(),
          incidentId,
          error: toLoggedError(cause),
        });
        return incidentId;
      }).pipe(Effect.provide(Layer.mergeAll(incidentsLayer, consoleSinkLayer))),
    );
    showNotice(describeDefect(incident, catalogFor(hostLanguage()).shell));
  } catch {
    // The host can reject a notice after it has shut down.
    return;
  }
}

async function reportBootstrapFailure(runtime: AppRuntime, cause: unknown): Promise<void> {
  try {
    await runtime.runPromise(reportDefect(cause));
  } catch {
    reportUnloadFailure(cause);
  }
}

export async function bootstrap(
  plugin: Plugin,
  { signal }: { readonly signal: AbortSignal },
): Promise<BootstrapHandle> {
  const runtime = makeRuntime(
    appLayer(
      plugin,
      { developmentMode: import.meta.env.MODE === "development", language: hostLanguage() },
      configuredAgentChat(async (executablePaths) => {
        const { createProviderCliChat } = await import("./infrastructure/provider-cli");
        return createProviderCliChat({ executablePaths });
      }),
    ),
  );
  const undo: Release[] = [() => runtime.dispose()];
  let disposal: Promise<void> | undefined;
  let started = false;
  let reloadSettings: (() => Promise<void>) | undefined;

  const handle: BootstrapHandle = {
    runtime,
    reloadSettings: () => reloadSettings?.() ?? Promise.resolve(),
    dispose: () => {
      reloadSettings = undefined;
      return (disposal ??= runUndo(undo.toReversed()));
    },
  };
  const aborted = () => signal.aborted;

  try {
    const mirror = await mirrorSettings(runtime);
    undo.push(() => mirror.stop());
    if (aborted()) {
      await handle.dispose();
      return handle;
    }

    const messages = await runtime.runPromise(Messages);
    if (aborted()) {
      await handle.dispose();
      return handle;
    }

    let opening = Promise.resolve();
    const open = (route?: Route, surfaceSignal?: string) => {
      const request = opening.then(() => {
        if (!aborted() && !disposal) return openRoute(plugin.app.workspace, route, surfaceSignal);
      });
      opening = request.catch(() => undefined);
      return request;
    };

    const removeCommands = registerCommands(plugin, runtime, appCommands, messages, open);
    undo.push(() => {
      if (!started) removeCommands();
    });

    const mcpItems = createMcpItemAccess(runtime, {
      current: noteSnapshot(itemType),
      changes: noteChanges(itemType),
    });
    const mcp = createMcpController({
      version: plugin.manifest.version,
      readItem: mcpItems.readItem,
    });
    undo.push(() => mcp.dispose());
    const agentSettings = createAgentSettingsPart({
      controller: mcp,
      runtime,
      mirror,
      messages,
      items: mcpItems.choices,
    });
    const tab = new ShellSettingTab(
      plugin.app,
      plugin,
      runtime,
      mirror,
      messages.shell,
      agentSettings,
    );
    addRibbonIcon(plugin, () =>
      runSafely(
        runtime,
        Effect.promise(() => open()),
      ),
    );
    plugin.addSettingTab(tab);
    undo.push(
      mcpItems.watchChoices(() => {
        if (tab.containerEl.isConnected) tab.update();
      }),
    );
    const surfaces = new Set<() => void>();
    plugin.registerView(
      SHELL_VIEW_TYPE,
      (leaf) => new ShellView(leaf, runtime, surfaces, appSurface),
    );
    undo.push(() => {
      const close = [...surfaces];
      surfaces.clear();
      releaseAll(close);
    });

    reloadSettings = async () => {
      await runSafely(
        runtime,
        SettingsService.use((settings) => settings.reload).pipe(
          Effect.flatMap(() => Effect.promise(() => mirror.refresh())),
          Effect.map(() => tab.update()),
        ),
      );
    };

    void runSafely(
      runtime,
      Logger.use((logger) => logger.log({ level: "info", event: "plugin.loaded" })),
    );
    started = true;
    return handle;
  } catch (cause) {
    await reportBootstrapFailure(runtime, cause);
    await handle.dispose().catch(reportUnloadFailure);
    throw cause;
  }
}
