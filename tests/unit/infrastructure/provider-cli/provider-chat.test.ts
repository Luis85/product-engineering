import { describe, expect, it, vi } from "vitest";
import type { ChatRequest } from "../../../../src/application/integrations";
import {
  createProviderChat,
  type ProviderTurn,
} from "../../../../src/infrastructure/provider-cli/adapter";

const messages = [
  { role: "user", content: "Original question" },
  { role: "assistant", content: "Answer" },
  { role: "user", content: "--dangerous-looking text \n later" },
] as const;

function claudeDelta(text: string, parent: string | null = null) {
  return {
    type: "stream_event",
    parent_tool_use_id: parent,
    event: { type: "content_block_delta", delta: { type: "text_delta", text } },
  };
}

async function collect(stream: AsyncIterable<string>): Promise<string[]> {
  const result: string[] = [];
  for await (const text of stream) result.push(text);
  return result;
}

function exchange(records: unknown[]) {
  return vi.fn<(turn: ProviderTurn, signal?: AbortSignal) => AsyncIterable<unknown>>(
    async function* () {
      yield* records;
    },
  );
}

describe("TanStack AI chat over the provider CLIs", () => {
  it("streams Claude text deltas, ignores subagent text, and passes the whole transcript over stdin", async () => {
    const run = exchange([
      claudeDelta("First "),
      claudeDelta("don't expose this", "subagent"),
      claudeDelta("answer."),
      { type: "result", subtype: "success", result: "First answer." },
      claudeDelta("after the final result"),
    ]);
    const provider = createProviderChat(run);
    const request: ChatRequest = { provider: "claude-code", messages };

    expect(await collect(provider.stream(request))).toEqual(["First ", "answer."]);

    expect(run).toHaveBeenCalledTimes(1);
    const turn = run.mock.calls[0]?.[0];
    if (!turn) throw new Error("Expected a CLI turn");
    expect(turn.provider).toBe("claude-code");
    expect(turn.stdin).toContain(JSON.stringify(messages));
    expect(turn.args).toContain("--restricted");
    expect(turn.args).toContain("--no-session-persistence");
    expect(turn.args).toContain("--strict-mcp-config");
    expect(turn.args).not.toContain("--bare");
    expect(turn.args).not.toContain(messages[2].content);
  });

  it("uses the final Claude text when the CLI supplied no deltas", async () => {
    const provider = createProviderChat(
      exchange([{ type: "result", subtype: "success", result: "Final answer." }]),
    );

    expect(await collect(provider.stream({ provider: "claude-code", messages }))).toEqual([
      "Final answer.",
    ]);
  });

  it("streams completed Codex assistant messages, excluding reasoning and other tool output", async () => {
    const run = exchange([
      { type: "thread.started", thread_id: "thread" },
      { type: "item.completed", item: { type: "reasoning", text: "hidden reasoning" } },
      { type: "item.completed", item: { type: "agent_message", text: "First" } },
      { type: "item.completed", item: { type: "command_execution", text: "hidden stdout" } },
      { type: "item.completed", item: { type: "agent_message", text: "Second" } },
      { type: "turn.completed" },
    ]);
    const provider = createProviderChat(run);
    expect(await collect(provider.stream({ provider: "codex", messages }))).toEqual([
      "First",
      "\n\nSecond",
    ]);
    expect(run).toHaveBeenCalledTimes(1);
    const turn = run.mock.calls[0]?.[0];
    if (!turn) throw new Error("Expected a CLI turn");
    expect(turn.provider).toBe("codex");
    expect(turn.stdin).toContain(JSON.stringify(messages));
    expect(turn.args).toContain("read-only");
    expect(turn.args).toContain("shell_tool");
    expect(turn.args).toContain("--ephemeral");
    expect(turn.args.at(-1)).toBe("-");
  });

  it.each([
    [
      "claude-code",
      {
        type: "result",
        subtype: "error_during_execution",
        is_error: true,
        errors: ["Not logged in · Please run /login secret"],
      },
      "authentication-required",
    ],
    ["codex", { type: "turn.failed", error: { message: "backend secret" } }, "process-failed"],
    ["codex", { type: "error", message: "Unauthorized (401)" }, "authentication-required"],
    ["codex", { type: "turn.started" }, "invalid-response"],
  ] as const)("classifies %s failures with a stable code", async (provider, event, reason) => {
    const chat = createProviderChat(exchange([event]));

    await expect(collect(chat.stream({ provider, messages }))).rejects.toMatchObject({
      _tag: "ProviderChatError",
      provider,
      reason,
    });
  });

  it("rejects an aborted request before invoking a provider", async () => {
    const run = exchange([]);
    const provider = createProviderChat(run);
    await expect(
      collect(provider.stream({ provider: "codex", messages }, AbortSignal.abort())),
    ).rejects.toMatchObject({ reason: "cancelled" });
    expect(run).not.toHaveBeenCalled();
  });

  it("rejects a transcript without a final user prompt before launching the CLI", async () => {
    const run = exchange([]);
    const provider = createProviderChat(run);
    await expect(
      collect(provider.stream({ provider: "codex", messages: [] })),
    ).rejects.toMatchObject({
      reason: "unsupported-request",
    });
    expect(run).not.toHaveBeenCalled();
  });
});
