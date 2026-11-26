import { Schema } from "effect";
import { AiMode } from "../../../domain/shell";

export type ChatProvider = Exclude<AiMode, "demo">;

const ChatFailure = Schema.Literals([
  "provider-not-found",
  "consent-required",
  "authentication-required",
  "process-failed",
  "invalid-response",
  "unsupported-request",
  "source-unavailable",
  "target-unavailable",
  "invalid-proposal",
  "cancelled",
]);
export type ChatFailure = typeof ChatFailure.Type;
export const isChatFailure = Schema.is(ChatFailure);

export class ProviderChatError extends Schema.TaggedError<ProviderChatError>()(
  "ProviderChatError",
  {
    provider: AiMode,
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
  readonly provider: AiMode;
  readonly messages: readonly ChatMessage[];
  readonly purpose?: "prototype-html" | "copilot-draft" | "copilot-revise";
}

export interface ProviderChat {
  readonly stream: (request: ChatRequest, signal?: AbortSignal) => AsyncIterable<string>;
}
