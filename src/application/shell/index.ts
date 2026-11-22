export { reportDefect, reportUnexpected } from "./defects";
export { copyDiagnostics } from "./diagnostics";
export {
  ClipboardError,
  InvalidSettingsError,
  ReadOnlySettingsError,
  StorageError,
  VaultReadError,
} from "./errors";
export { LANGUAGES, PRODUCT_NAME } from "./i18n/catalog";
export type { Language } from "./i18n/catalog";
export { describeIssue } from "./i18n/describe";
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
export type { UserMessage } from "./user-messages";
export { setLogLevel } from "./use-cases";
