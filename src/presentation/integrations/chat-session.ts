import { chatFailureOf, ProviderChatError } from "../../application/integrations";
import type {
  ChatFailure,
  ChatMessage,
  ChatRequest,
  ProviderChat,
} from "../../application/integrations";
import type { AiMode } from "../../domain/shell";

export interface ChatSessionState {
  readonly messages: readonly ChatMessage[];
  readonly pending: boolean;
  readonly failure?: { readonly provider: AiMode; readonly reason: ChatFailure };
}

type Listener = (state: ChatSessionState) => void;

function streamFailure(error: unknown, provider: AiMode, signal: AbortSignal) {
  const reason = chatFailureOf(error);
  if (!signal.aborted && reason !== "cancelled") return { provider, reason };
}

export function createChatSession(chat: ProviderChat) {
  let snapshot: ChatSessionState = { messages: [], pending: false };
  let disposed = false;
  let active: AbortController | undefined;
  const listeners = new Set<Listener>();

  function publish(state: ChatSessionState): void {
    if (disposed) return;
    snapshot = state;
    for (const listener of listeners) listener(state);
  }

  async function receive(
    request: ChatRequest,
    conversation: readonly ChatMessage[],
    signal: AbortSignal,
  ): Promise<string> {
    if (signal.aborted) return "";
    let reply = "";
    for await (const delta of chat.stream(request, signal)) {
      if (signal.aborted) break;
      if (!delta) continue;
      if (reply.length + delta.length > 96_000)
        throw new ProviderChatError({ provider: request.provider, reason: "invalid-response" });
      reply += delta;
      const messages = [...conversation, { role: "assistant", content: reply }] as const;
      publish({ messages, pending: true });
    }
    if (!signal.aborted && !reply.trim())
      throw new ProviderChatError({ provider: request.provider, reason: "invalid-response" });
    return reply;
  }

  function settle(controller: AbortController, failure: ChatSessionState["failure"]) {
    if (active !== controller) return;
    active = undefined;
    const messages = snapshot.messages;
    publish({ messages, pending: false, ...(failure && { failure }) });
  }

  async function send(
    provider: AiMode,
    text: string,
    context?: Omit<ChatRequest, "provider">,
  ): Promise<string | undefined> {
    if (disposed || active || !text.trim()) return;

    const controller = new AbortController();
    active = controller;
    const messages = [...snapshot.messages, { role: "user", content: text }] as const;
    let failure: ChatSessionState["failure"];
    try {
      publish({ messages, pending: true });
      const reply = await receive({ provider, messages, ...context }, messages, controller.signal);
      if (!controller.signal.aborted) return reply;
    } catch (error) {
      failure = streamFailure(error, provider, controller.signal);
    } finally {
      settle(controller, failure);
    }
  }

  return {
    getState: () => snapshot,
    subscribe(listener: Listener): () => void {
      if (!disposed) {
        listeners.add(listener);
        listener(snapshot);
      }
      return () => {
        listeners.delete(listener);
      };
    },
    send,
    cancel(): void {
      active?.abort();
    },
    reset(messages: readonly ChatMessage[] = []): void {
      const previous = active;
      active = undefined;
      previous?.abort();
      publish({ messages, pending: false });
    },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      listeners.clear();
      active?.abort();
    },
  };
}
