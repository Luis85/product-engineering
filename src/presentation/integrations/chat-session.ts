import { chatFailureOf } from "../../application/integrations";
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

  async function receive(request: ChatRequest, signal: AbortSignal): Promise<void> {
    if (signal.aborted) return;
    let reply = "";
    for await (const delta of chat.stream(request, signal)) {
      if (signal.aborted) break;
      if (!delta) continue;
      reply += delta;
      const messages = [...request.messages, { role: "assistant", content: reply }] as const;
      publish({ messages, pending: true });
    }
  }

  async function send(provider: AiMode, text: string): Promise<void> {
    if (disposed || active || !text.trim()) return;

    const controller = new AbortController();
    active = controller;
    const messages = [...snapshot.messages, { role: "user", content: text }] as const;
    let failure: ChatSessionState["failure"];
    try {
      publish({ messages, pending: true });
      await receive({ provider, messages }, controller.signal);
    } catch (error) {
      const reason = chatFailureOf(error);
      if (!controller.signal.aborted && reason !== "cancelled") failure = { provider, reason };
    } finally {
      if (active === controller) {
        active = undefined;
        const settled = { messages: snapshot.messages, pending: false };
        publish(failure ? { ...settled, failure } : settled);
      }
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
    reset(): void {
      const previous = active;
      active = undefined;
      previous?.abort();
      publish({ messages: [], pending: false });
    },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      listeners.clear();
      active?.abort();
    },
  };
}
