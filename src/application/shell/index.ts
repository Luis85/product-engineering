export { reportDefect, reportUnexpected } from "./defects";
export { copyDiagnostics } from "./diagnostics";
export { EventBus, EventBusLive } from "./event-bus";
export type { ShellEvents } from "./events";
export {
  ClipboardError,
  InvalidSettingsError,
  ReadOnlySettingsError,
  StorageError,
  VaultReadError,
} from "./errors";
export { ISSUES_URL, LANGUAGES, PRODUCT_NAME } from "./i18n/catalog";
export type { Language, ShellCatalog } from "./i18n/catalog";
export { describeDefect, describeIssue, describeShellError } from "./i18n/describe";
export { toLoggedError } from "./logged-error";
export { LoggerLive } from "./logger";
export { shellModule } from "./module";
export {
  Clipboard,
  HostInfo,
  Incidents,
  Logger,
  LogSink,
  Messages,
  Notifier,
  SettingsStore,
} from "./ports";
export type { DatedLogEntry } from "./ports";
export type { ShellServices } from "./services";
export { SettingsService, SettingsServiceLive } from "./settings-service";
export type { SettingsStatus } from "./settings-service";
export type { UserMessage } from "./user-messages";
export { setLogLevel } from "./use-cases";
