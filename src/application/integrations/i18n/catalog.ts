import type { Language, UserMessage } from "../../shell";
import type { ChatFailure, ChatProvider, ProviderChatError } from "../chat";
import type { McpSettingsAction, McpSettingsError } from "../mcp/settings-error";

type ChatFailureText = (provider: string) => UserMessage;
type SettingText = { readonly name: string; readonly desc: string };
type MessageText = { readonly title: string; readonly detail: string };

export interface IntegrationsCatalog {
  readonly language: Language;
  readonly providers: Readonly<Record<ChatProvider, string>>;
  readonly chatFailures: Readonly<Record<ChatFailure, ChatFailureText>>;
  readonly chat: {
    readonly title: string;
    readonly provider: string;
    readonly recipientHint: string;
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
      readonly errors: Readonly<Record<McpSettingsAction, MessageText>>;
    };
    readonly ai: {
      readonly title: string;
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
