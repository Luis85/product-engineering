import { Effect } from "effect";
import { expect, it, vi } from "vitest";
import {
  AgentChat,
  configuredAgentChat,
  ProviderChatError,
} from "../../../src/application/integrations";
import type { ChatProvider, ProviderChat } from "../../../src/application/integrations";
import { SettingsService } from "../../../src/application/shell";
import { testRuntime } from "../../support/runtime";

async function collect(output: AsyncIterable<string>): Promise<string[]> {
  const chunks: string[] = [];
  for await (const chunk of output) chunks.push(chunk);
  return chunks;
}

it("reads configured executable paths for each chat request", async () => {
  const fixture = testRuntime({ initialSettings: { claudeCodePath: "/bin/claude" } });
  const factory = vi.fn<(paths: Readonly<Partial<Record<ChatProvider, string>>>) => ProviderChat>(
    (paths) => ({
      async *stream() {
        yield JSON.stringify(paths);
      },
    }),
  );
  const request = { provider: "codex", messages: [{ role: "user", content: "Hello" }] } as const;
  try {
    const chat = await fixture.runtime.runPromise(
      Effect.provide(AgentChat, configuredAgentChat(factory)),
    );
    await expect(collect(chat.stream(request))).resolves.toEqual(['{"claude-code":"/bin/claude"}']);
    await fixture.runtime.runPromise(
      SettingsService.use((settings) =>
        settings.update({ claudeCodePath: undefined, codexPath: "/bin/codex" }),
      ),
    );
    await expect(collect(chat.stream(request))).resolves.toEqual(['{"codex":"/bin/codex"}']);
    expect(factory).toHaveBeenCalledTimes(2);
  } finally {
    await fixture.runtime.dispose();
  }
});

it("gives a typed unavailable result when no desktop provider adapter is supplied", async () => {
  const fixture = testRuntime();
  try {
    const chat = await fixture.runtime.runPromise(AgentChat);
    await expect(collect(chat.stream({ provider: "codex", messages: [] }))).rejects.toEqual(
      new ProviderChatError({ provider: "codex", reason: "provider-not-found" }),
    );
  } finally {
    await fixture.runtime.dispose();
  }
});
