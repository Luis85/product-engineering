import { Context, Effect, Layer, Stream } from "effect";
import { SettingsService } from "../../shell";
import { aiCapability, sameAiCapability } from "./capability";
import { ProviderChatError } from "./index";
import type { ChatProvider, ProviderChat } from "./index";

export class AgentChat extends Context.Service<AgentChat, ProviderChat>()(
  "product-engineering/application/AgentChat",
) {}

export const unavailableAgentChat = Layer.succeed(AgentChat, {
  stream: ({ provider }) => ({
    [Symbol.asyncIterator]() {
      return {
        next: () =>
          Promise.reject(new ProviderChatError({ provider, reason: "provider-not-found" })),
      };
    },
  }),
});

export function deterministicDemoChat(reply: string): ProviderChat {
  return {
    async *stream({ provider }, signal) {
      if (signal?.aborted) throw new ProviderChatError({ provider, reason: "cancelled" });
      yield reply;
    },
  };
}

export function configuredAgentChat(
  factory: (
    executablePaths: Readonly<Partial<Record<ChatProvider, string>>>,
  ) => ProviderChat | Promise<ProviderChat>,
  demo?: ProviderChat,
) {
  return Layer.effect(
    AgentChat,
    Effect.map(SettingsService, ({ current, changes }) => ({
      async *stream(request, callerSignal) {
        const { provider } = request;
        const settings = Effect.runSync(current);
        const capability = aiCapability(settings);
        if (!capability.enabled)
          throw new ProviderChatError({ provider, reason: "consent-required" });
        if (capability.mode !== provider)
          throw new ProviderChatError({ provider, reason: "unsupported-request" });

        const changed = new AbortController();
        const observer = new AbortController();
        const signal = callerSignal
          ? AbortSignal.any([changed.signal, callerSignal])
          : changed.signal;
        const stillConfigured = () =>
          sameAiCapability(capability, aiCapability(Effect.runSync(current)));
        const checkActive = () => {
          if (signal.aborted || !stillConfigured()) {
            throw new ProviderChatError({ provider, reason: "cancelled" });
          }
        };
        const watching = Effect.runPromiseExit(
          Stream.runForEach(changes, (next) =>
            Effect.sync(() => {
              if (!sameAiCapability(capability, aiCapability(next))) changed.abort();
            }),
          ),
          { signal: observer.signal },
        );
        const paths = {
          ...(settings.claudeCodePath ? { "claude-code": settings.claudeCodePath } : {}),
          ...(settings.codexPath ? { codex: settings.codexPath } : {}),
        };
        try {
          checkActive();
          const chat = provider === "demo" ? demo : await factory(paths);
          checkActive();
          if (!chat) throw new ProviderChatError({ provider, reason: "provider-not-found" });
          for await (const delta of chat.stream(request, signal)) {
            checkActive();
            yield delta;
          }
          checkActive();
        } finally {
          observer.abort();
          await watching;
        }
      },
    })),
  );
}
