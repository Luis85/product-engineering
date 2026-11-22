import { Schema } from "effect";

const ChatProvider = Schema.Literals(["claude-code", "codex"]);
export type ChatProvider = typeof ChatProvider.Type;

const ChatFailure = Schema.Literals([
  "provider-not-found",
  "authentication-required",
  "process-failed",
  "invalid-response",
  "unsupported-request",
  "cancelled",
]);
export type ChatFailure = typeof ChatFailure.Type;
export const isChatFailure = Schema.is(ChatFailure);

export class ProviderChatError extends Schema.TaggedError<ProviderChatError>()(
  "ProviderChatError",
  {
    provider: ChatProvider,
    reason: ChatFailure,
  },
) {}

export function chatFailureOf(error: unknown): ChatFailure {
  return error instanceof ProviderChatError ? error.reason : "process-failed";
}

export interface ChatMessage {
  readonly role: "user" | "assistant";
  readonly content: string;
}

export interface ChatRequest {
  readonly provider: ChatProvider;
  readonly messages: readonly ChatMessage[];
}

export interface ProviderChat {
  readonly stream: (request: ChatRequest, signal?: AbortSignal) => AsyncIterable<string>;
}
