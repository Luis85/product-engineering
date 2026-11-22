import { Context, Effect, Layer } from "effect";
import { SettingsService } from "../../shell";
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

export function configuredAgentChat(
  factory: (
    executablePaths: Readonly<Partial<Record<ChatProvider, string>>>,
  ) => ProviderChat | Promise<ProviderChat>,
) {
  return Layer.effect(
    AgentChat,
    Effect.map(SettingsService, ({ current }) => ({
      async *stream(request, signal) {
        const settings = await Effect.runPromise(current, { signal });
        const paths = {
          ...(settings.claudeCodePath ? { "claude-code": settings.claudeCodePath } : {}),
          ...(settings.codexPath ? { codex: settings.codexPath } : {}),
        };
        const chat = await factory(paths);
        yield* chat.stream(request, signal);
      },
    })),
  );
}
