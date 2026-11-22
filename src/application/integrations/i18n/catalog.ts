import type { Language, UserMessage } from "../../shell";
import type { ChatFailure, ChatProvider, ProviderChatError } from "../chat";

type ChatFailureText = (provider: string) => UserMessage;

export interface IntegrationsCatalog {
  readonly language: Language;
  readonly providers: Readonly<Record<ChatProvider, string>>;
  readonly chatFailures: Readonly<Record<ChatFailure, ChatFailureText>>;
}

export function describeProviderChatError(
  error: ProviderChatError,
  catalog: IntegrationsCatalog,
): UserMessage {
  return catalog.chatFailures[error.reason](catalog.providers[error.provider]);
}
