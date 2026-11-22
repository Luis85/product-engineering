import { Effect, Layer } from "effect";
import { apiVersion, Platform } from "obsidian";
import type { Plugin } from "obsidian";
import type { AppAdapters } from "../../../application/app-services-layer";
import {
  Clipboard,
  ClipboardError,
  HostInfo,
  Notifier,
  SettingsStore,
  StorageError,
} from "../../../application/shell";
import { consoleSinkLayer } from "../../logging/console-sink";
import { incidentsLayer } from "../../logging/incidents";
import { hostEventsLayer } from "./events";
import { showNotice } from "./notices";

function platformName(): string {
  if (Platform.isIosApp) return "iOS";
  if (Platform.isAndroidApp) return "Android";
  if (Platform.isMacOS) return "macOS";
  if (Platform.isWin) return "Windows";
  if (Platform.isLinux) return "Linux";
  return "Unknown";
}

export function shellAdapters(plugin: Plugin): AppAdapters {
  return {
    settingsStore: Layer.succeed(SettingsStore, {
      load: Effect.tryPromise({
        try: (): Promise<unknown> => plugin.loadData(),
        catch: (cause) => new StorageError({ cause }),
      }),
      save: (data) =>
        Effect.tryPromise({
          try: () => plugin.saveData(data),
          catch: (cause) => new StorageError({ cause }),
        }),
    }),
    notifier: Layer.succeed(Notifier, {
      notify: (message) =>
        Effect.sync(() => {
          showNotice(message);
        }),
    }),
    clipboard: Layer.succeed(Clipboard, {
      write: (text) =>
        Effect.tryPromise({
          try: () => navigator.clipboard.writeText(text),
          catch: (cause) => new ClipboardError({ cause }),
        }),
    }),
    hostInfo: Layer.succeed(HostInfo, {
      pluginVersion: plugin.manifest.version,
      apiVersion,
      platform: platformName(),
    }),
    incidents: incidentsLayer,
    logSink: consoleSinkLayer,
    hostEvents: hostEventsLayer(plugin),
  };
}
