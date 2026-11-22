import type { Clipboard, HostInfo, Incidents, Logger, Messages, Notifier } from "./ports";
import type { SettingsService } from "./settings-service";

export type ShellServices =
  SettingsService | Logger | Notifier | Clipboard | HostInfo | Messages | Incidents;
