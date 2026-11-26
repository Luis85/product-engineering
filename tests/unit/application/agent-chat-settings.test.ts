import { Effect } from "effect";
import { expect, it, vi } from "vitest";
import {
  AgentChat,
  configuredAgentChat,
  deterministicDemoChat,
  ProviderChatError,
} from "../../../src/application/integrations";
import type { ChatProvider, ProviderChat } from "../../../src/application/integrations";
import { SettingsService } from "../../../src/application/shell";
import { testRuntime } from "../../support/runtime";
import { eventually } from "../../support/wait";

async function collect(output: AsyncIterable<string>): Promise<string[]> {
  const chunks: string[] = [];
  for await (const chunk of output) chunks.push(chunk);
  return chunks;
}

function latch() {
  let release: (() => void) | undefined;
  const ready = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { ready, release: () => release?.() };
}

it("blocks a configured desktop provider before global AI consent", async () => {
  const fixture = testRuntime({ initialSettings: { codexPath: "/bin/codex" } });
  const factory = vi.fn<() => ProviderChat>(() => ({
    async *stream() {
      yield "Provider output";
    },
  }));
  try {
    const chat = await fixture.runtime.runPromise(
      Effect.provide(AgentChat, configuredAgentChat(factory)),
    );
    await expect(collect(chat.stream({ provider: "codex", messages: [] }))).rejects.toMatchObject({
      reason: "consent-required",
    });
    expect(factory).not.toHaveBeenCalled();
  } finally {
    await fixture.runtime.dispose();
  }
});

it("blocks direct requests to a CLI outside the active execution mode", async () => {
  const fixture = testRuntime({ initialSettings: { aiEnabled: true, aiMode: "demo" } });
  const factory = vi.fn<() => ProviderChat>(() => ({
    async *stream() {
      yield "Unexpected CLI output";
    },
  }));
  try {
    const chat = await fixture.runtime.runPromise(
      Effect.provide(AgentChat, configuredAgentChat(factory)),
    );
    await expect(
      collect(chat.stream({ provider: "codex", messages: [{ role: "user", content: "Test" }] })),
    ).rejects.toMatchObject({ reason: "unsupported-request" });
    expect(factory).not.toHaveBeenCalled();
  } finally {
    await fixture.runtime.dispose();
  }
});

it("runs the deterministic local demo on explicit request without opening a CLI", async () => {
  const fixture = testRuntime({ initialSettings: { aiEnabled: true, codexPath: "/tools/codex" } });
  const factory = vi.fn<() => ProviderChat>();
  try {
    const chat = await fixture.runtime.runPromise(
      Effect.provide(
        AgentChat,
        configuredAgentChat(factory, deterministicDemoChat("Sample reply")),
      ),
    );
    expect(factory).not.toHaveBeenCalled();
    await expect(
      collect(chat.stream({ provider: "demo", messages: [{ role: "user", content: "Test" }] })),
    ).resolves.toEqual(["Sample reply"]);
    expect(factory).not.toHaveBeenCalled();
  } finally {
    await fixture.runtime.dispose();
  }
});

it.each([
  { aiEnabled: false },
  { aiMode: "claude-code" },
  { codexPath: "/tools/replacement-codex" },
])("aborts direct in-flight transport and drops late data when AI changes %j", async (change) => {
  const fixture = testRuntime({ initialSettings: { aiEnabled: true, aiMode: "codex" } });
  const started = latch();
  const finish = latch();
  const stream = vi.fn<ProviderChat["stream"]>(async function* () {
    started.release();
    await finish.ready;
    yield "LATE-OUTPUT";
  });
  try {
    const chat = await fixture.runtime.runPromise(
      Effect.provide(
        AgentChat,
        configuredAgentChat(() => ({ stream })),
      ),
    );
    const output = chat.stream({
      provider: "codex",
      messages: [{ role: "user", content: "Test" }],
    });
    const observed: string[] = [];
    const pending = (async () => {
      for await (const chunk of output) observed.push(chunk);
    })().catch((error: unknown) => error);
    await started.ready;
    await fixture.runtime.runPromise(SettingsService.use((settings) => settings.update(change)));
    try {
      await eventually(() => expect(stream.mock.calls[0]?.[1]?.aborted).toBe(true));
      await fixture.runtime.runPromise(
        SettingsService.use((settings) =>
          settings.update({ aiEnabled: true, aiMode: "codex", codexPath: undefined }),
        ),
      );
    } finally {
      finish.release();
    }
    expect(await pending).toMatchObject({ reason: "cancelled" });
    expect(observed).toEqual([]);
  } finally {
    finish.release();
    await fixture.runtime.dispose();
  }
});

it("reads configured executable paths for each chat request", async () => {
  const fixture = testRuntime({
    initialSettings: { claudeCodePath: "/bin/claude", aiEnabled: true, aiMode: "codex" },
  });
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
