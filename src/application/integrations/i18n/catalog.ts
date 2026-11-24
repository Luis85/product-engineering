import type { AiMode } from "../../../domain/shell";
import type { Language, UserMessage } from "../../shell";
import type { ChatFailure, ProviderChatError } from "../chat";
import type { McpSettingsAction, McpSettingsError } from "../mcp/settings-error";

type ChatFailureText = (provider: string) => UserMessage;
type SettingText = { readonly name: string; readonly desc: string };
type MessageText = { readonly title: string; readonly detail: string };

export interface IntegrationsCatalog {
  readonly language: Language;
  readonly providers: Readonly<Record<AiMode, string>>;
  readonly chatFailures: Readonly<Record<ChatFailure, ChatFailureText>>;
  readonly chat: {
    readonly title: string;
    readonly demoReply: string;
    readonly correctExecutable: string;
    readonly conversation: string;
    readonly empty: string;
    readonly message: string;
    readonly send: string;
    readonly stop: string;
    readonly responding: string;
    readonly stopping: string;
    readonly stopped: string;
    readonly speakers: Readonly<Record<"user" | "assistant", string>>;
  };
  readonly settings: {
    readonly mcp: {
      readonly title: string;
      readonly port: SettingText;
      readonly running: (endpoint: string) => string;
      readonly stopped: string;
      readonly start: string;
      readonly stop: string;
      readonly copy: string;
      readonly copied: MessageText;
      readonly sharing: {
        readonly title: string;
        readonly description: string;
        readonly loading: string;
        readonly unavailable: string;
        readonly empty: string;
        readonly unavailableItem: string;
      };
      readonly errors: Readonly<Record<McpSettingsAction, MessageText>>;
    };
    readonly ai: {
      readonly title: string;
      readonly enabled: SettingText;
      readonly connection: string;
      readonly mode: SettingText;
      readonly modes: Readonly<Record<AiMode, string>>;
      readonly destination: string;
      readonly disclosure: (mode: AiMode) => string;
      readonly claudeCodePath: SettingText;
      readonly codexPath: SettingText;
    };
  };
}

export function describeProviderChatError(
  error: ProviderChatError,
  catalog: IntegrationsCatalog,
): UserMessage {
  return catalog.chatFailures[error.reason](catalog.providers[error.provider]);
}

export function describeIntegrationError(
  error: ProviderChatError | McpSettingsError,
  catalog: IntegrationsCatalog,
): UserMessage {
  switch (error._tag) {
    case "ProviderChatError":
      return describeProviderChatError(error, catalog);
    case "McpSettingsError":
      return { severity: "error", action: "retry", ...catalog.settings.mcp.errors[error.action] };
  }
}
