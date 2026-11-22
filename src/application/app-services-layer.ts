import { Layer } from "effect";
import { unavailableAgentChat } from "./integrations";
import type { AgentChat } from "./integrations";
import { messagesLayer } from "./messages";
import { servicesLayerOf } from "./module";
import { APP_MODULES } from "./modules";
import { EventBusLive, LoggerLive, SettingsServiceLive } from "./shell";
import type { AppServices } from "./app-services";
import type {
  Clipboard,
  HostInfo,
  Incidents,
  Language,
  LogSink,
  Notifier,
  SettingsStore,
  SettingsService,
  ShellServices,
} from "./shell";

export type AppAdapters = {
  readonly settingsStore: Layer.Layer<SettingsStore>;
  readonly notifier: Layer.Layer<Notifier>;
  readonly clipboard: Layer.Layer<Clipboard>;
  readonly hostInfo: Layer.Layer<HostInfo>;
  readonly incidents: Layer.Layer<Incidents>;
  readonly logSink: Layer.Layer<LogSink>;
  readonly hostEvents: Layer.Layer<never, never, ShellServices>;
  readonly agentChat?: Layer.Layer<AgentChat, never, SettingsService>;
};

export type AppServiceOptions = {
  readonly language: Language;
  readonly developmentMode: boolean;
};

export function appServicesLayer(
  adapters: AppAdapters,
  options: AppServiceOptions,
): Layer.Layer<AppServices> {
  const ports = Layer.mergeAll(
    adapters.settingsStore,
    adapters.notifier,
    adapters.clipboard,
    adapters.hostInfo,
    adapters.incidents,
    adapters.logSink,
    messagesLayer(options.language),
  );
  const settings = Layer.provideMerge(SettingsServiceLive, ports);
  const shell = Layer.mergeAll(Layer.provideMerge(LoggerLive(options), settings), EventBusLive);
  const chat = Layer.provideMerge(adapters.agentChat ?? unavailableAgentChat, shell);
  const services = Layer.provideMerge(servicesLayerOf(APP_MODULES), chat);
  return Layer.provideMerge(adapters.hostEvents, services);
}
