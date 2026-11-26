import { randomUUID } from "node:crypto";
import { chat, EventType } from "@tanstack/ai";
import type {
  AdapterYieldChunk,
  DefaultMessageMetadataByModality,
  TextOptions,
} from "@tanstack/ai";
import { BaseTextAdapter } from "@tanstack/ai/adapters";
import { isChatFailure, ProviderChatError } from "../../application/integrations";
import type { ChatProvider, ChatRequest, ProviderChat } from "../../application/integrations";
import { providerText, providerTurn } from "./protocol";
import type { ProviderRun } from "./protocol";

export type { ProviderTurn } from "./protocol";

type Options = Record<string, never>;

function inputFor(provider: ChatProvider, options: TextOptions<Options>): string {
  if (options.tools?.length)
    throw new ProviderChatError({ provider, reason: "unsupported-request" });
  const messages = options.messages.map(({ role, content }) => {
    if (role === "tool" || typeof content !== "string") {
      throw new ProviderChatError({ provider, reason: "unsupported-request" });
    }
    return { role, content };
  });
  const latest = messages.at(-1);
  if (latest?.role !== "user" || !latest.content.trim()) {
    throw new ProviderChatError({ provider, reason: "unsupported-request" });
  }
  return (
    "Continue this conversation as the assistant. Answer the latest user message.\n" +
    JSON.stringify(messages)
  );
}

class CliTextAdapter extends BaseTextAdapter<
  ChatProvider,
  Options,
  readonly ["text"],
  DefaultMessageMetadataByModality,
  readonly []
> {
  override readonly inputModalities = ["text"] as const;

  constructor(
    readonly name: ChatProvider,
    private readonly runProvider: ProviderRun,
    private readonly signal: AbortSignal | undefined,
  ) {
    super(undefined, name);
  }

  structuredOutput(): Promise<never> {
    return Promise.reject(
      new ProviderChatError({ provider: this.name, reason: "unsupported-request" }),
    );
  }

  async *chatStream(options: TextOptions<Options>): AsyncIterable<AdapterYieldChunk> {
    const runId = options.runId ?? this.generateId();
    const threadId = options.threadId ?? this.generateId();
    const messageId = this.generateId();
    yield { type: EventType.RUN_STARTED, runId, threadId, timestamp: Date.now() };
    yield {
      type: EventType.TEXT_MESSAGE_START,
      role: "assistant",
      messageId,
      timestamp: Date.now(),
    };

    try {
      const input = inputFor(this.name, options);
      const events = this.runProvider(providerTurn(this.name, input), this.signal);
      for await (const delta of providerText(this.name, events)) {
        yield { type: EventType.TEXT_MESSAGE_CONTENT, messageId, delta, timestamp: Date.now() };
      }
    } catch (error) {
      if (!(error instanceof ProviderChatError)) throw error;
      yield { type: EventType.TEXT_MESSAGE_END, messageId, timestamp: Date.now() };
      yield {
        type: EventType.RUN_ERROR,
        code: error.reason,
        message: error.reason,
        timestamp: Date.now(),
      };
      return;
    }

    yield { type: EventType.TEXT_MESSAGE_END, messageId, timestamp: Date.now() };
    yield {
      type: EventType.RUN_FINISHED,
      threadId,
      runId,
      finishReason: "stop",
      timestamp: Date.now(),
    };
  }
}

export function createProviderChat(run: ProviderRun): ProviderChat {
  return {
    async *stream({ provider, messages }: ChatRequest, signal?: AbortSignal) {
      if (signal?.aborted) throw new ProviderChatError({ provider, reason: "cancelled" });
      if (provider === "demo")
        throw new ProviderChatError({ provider, reason: "unsupported-request" });

      const adapter = new CliTextAdapter(provider, run, signal);
      const stream = chat({ adapter, messages: [...messages], threadId: randomUUID() });
      for await (const event of stream) {
        if (event.type === EventType.TEXT_MESSAGE_CONTENT) yield event.delta;
        if (event.type === EventType.RUN_ERROR) {
          const reason = isChatFailure(event.code) ? event.code : "process-failed";
          throw new ProviderChatError({ provider, reason });
        }
      }
    },
  };
}
