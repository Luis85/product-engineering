import { Context } from "effect";
import type { Effect } from "effect";
import type { LogLevel } from "../../domain/shell";
import type { Catalog } from "../messages";
import type { ClipboardError, StorageError } from "./errors";
import type { LoggedError } from "./logged-error";
import type { UserMessage } from "./user-messages";

export type LogEvent =
  "defect.reported" | "plugin.loaded" | "plugin.unload.failed" | "settings.load.failed";
export type LogEntry = {
  readonly level: LogLevel;
  readonly event: LogEvent;
  readonly data?: Readonly<Record<string, number | boolean>>;
  readonly error?: LoggedError;
  readonly incidentId?: string;
};

export type DatedLogEntry = LogEntry & { readonly timestamp: number };

export class SettingsStore extends Context.Service<
  SettingsStore,
  {
    readonly load: Effect.Effect<unknown, StorageError>;
    readonly save: (data: unknown) => Effect.Effect<void, StorageError>;
  }
>()("product-engineering/application/SettingsStore") {}

export class Notifier extends Context.Service<
  Notifier,
  {
    readonly notify: (message: UserMessage) => Effect.Effect<void>;
  }
>()("product-engineering/application/Notifier") {}

export class Logger extends Context.Service<
  Logger,
  {
    readonly log: (entry: LogEntry) => Effect.Effect<void>;
    readonly recent: Effect.Effect<readonly DatedLogEntry[]>;
  }
>()("product-engineering/application/Logger") {}

export class LogSink extends Context.Service<
  LogSink,
  {
    readonly write: (entry: DatedLogEntry) => Effect.Effect<void>;
  }
>()("product-engineering/application/LogSink") {}

export class Incidents extends Context.Service<
  Incidents,
  {
    readonly nextId: Effect.Effect<string>;
  }
>()("product-engineering/application/Incidents") {}

export class Clipboard extends Context.Service<
  Clipboard,
  {
    readonly write: (text: string) => Effect.Effect<void, ClipboardError>;
  }
>()("product-engineering/application/Clipboard") {}

export class HostInfo extends Context.Service<
  HostInfo,
  {
    readonly pluginVersion: string;
    readonly apiVersion: string;
    readonly platform: string;
  }
>()("product-engineering/application/HostInfo") {}

export class Messages extends Context.Service<Messages, Catalog>()(
  "product-engineering/application/Messages",
) {}
