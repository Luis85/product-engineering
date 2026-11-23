import { Layer } from "effect";
import type { NoteType } from "../domain/notes";
import { unavailableArtifactGit } from "./git";
import type { ArtifactGit } from "./git";
import { unavailableAgentChat } from "./integrations";
import type { AgentChat } from "./integrations";
import { messagesLayer } from "./messages";
import { servicesLayerOf } from "./module";
import { APP_MODULES } from "./modules";
import { appNoteTypes } from "./note-types";
import { noteIndexLayer } from "./notes";
import type { IdGenerator, NoteOpener, NoteStore } from "./notes";
import { unavailableProjectIntegrationHost } from "./projects";
import type { ProjectFiles, ProjectIntegrationHost } from "./projects";
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
  readonly artifactGit?: Layer.Layer<ArtifactGit>;
  readonly settingsStore: Layer.Layer<SettingsStore>;
  readonly notifier: Layer.Layer<Notifier>;
  readonly clipboard: Layer.Layer<Clipboard>;
  readonly hostInfo: Layer.Layer<HostInfo>;
  readonly incidents: Layer.Layer<Incidents>;
  readonly logSink: Layer.Layer<LogSink>;
  readonly hostEvents: Layer.Layer<never, never, ShellServices>;
  readonly noteStore: Layer.Layer<NoteStore>;
  readonly noteOpener: Layer.Layer<NoteOpener>;
  readonly idGenerator: Layer.Layer<IdGenerator>;
  readonly projectFiles: Layer.Layer<ProjectFiles>;
  readonly projectIntegrationHost?: Layer.Layer<ProjectIntegrationHost>;
  readonly agentChat?: Layer.Layer<AgentChat, never, SettingsService>;
};

export type AppServiceOptions = {
  readonly language: Language;
  readonly developmentMode: boolean;
  readonly noteTypes?: readonly NoteType[];
};

export function appServicesLayer(
  adapters: AppAdapters,
  options: AppServiceOptions,
): Layer.Layer<AppServices> {
  const ports = Layer.mergeAll(
    adapters.artifactGit ?? unavailableArtifactGit,
    adapters.settingsStore,
    adapters.notifier,
    adapters.clipboard,
    adapters.hostInfo,
    adapters.incidents,
    adapters.logSink,
    adapters.noteStore,
    adapters.noteOpener,
    adapters.idGenerator,
    adapters.projectFiles,
    adapters.projectIntegrationHost ?? unavailableProjectIntegrationHost,
    messagesLayer(options.language),
  );
  const settings = Layer.provideMerge(SettingsServiceLive, ports);
  const shell = Layer.mergeAll(Layer.provideMerge(LoggerLive(options), settings), EventBusLive);
  const chat = Layer.provideMerge(adapters.agentChat ?? unavailableAgentChat, shell);
  const withIndex = Layer.provideMerge(noteIndexLayer(options.noteTypes ?? appNoteTypes), chat);
  const services = Layer.provideMerge(servicesLayerOf(APP_MODULES), withIndex);
  return Layer.provideMerge(adapters.hostEvents, services);
}
