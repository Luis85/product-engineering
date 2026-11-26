import { expect, it, vi } from "vitest";
import { ProviderChatError } from "../../../../src/application/integrations";
import type { ProviderChat } from "../../../../src/application/integrations";
import { createChatSession } from "../../../../src/presentation/integrations/chat-session";
import type { ChatSessionState } from "../../../../src/presentation/integrations/chat-session";

function latch() {
  let resolve: (() => void) | undefined;
  const ready = new Promise<void>((release) => {
    resolve = release;
  });
  return { ready, release: () => resolve?.() };
}

function pausedReply() {
  const waiting = latch();
  const resume = latch();
  const stream = vi.fn<ProviderChat["stream"]>(async function* () {
    yield "Partial";
    waiting.release();
    await resume.ready;
    yield " reply";
  });
  return { stream, waiting, resume };
}

it("publishes streamed text and replays history from this conversation only", async () => {
  const stream = vi.fn<ProviderChat["stream"]>(async function* () {
    yield "Reply";
  });
  const session = createChatSession({ stream });
  const other = createChatSession({ stream });
  const updates: ChatSessionState[] = [];
  session.subscribe((state) => {
    updates.push(state);
  });

  await session.send("codex", "First");
  await session.send("claude-code", "Second");

  expect(updates[0]).toEqual({ pending: false, messages: [] });
  expect(updates[1]).toEqual({ pending: true, messages: [{ role: "user", content: "First" }] });
  expect(session.getState()).toEqual({
    pending: false,
    messages: [
      { role: "user", content: "First" },
      { role: "assistant", content: "Reply" },
      { role: "user", content: "Second" },
      { role: "assistant", content: "Reply" },
    ],
  });
  expect(stream.mock.calls[1]?.[0]).toEqual({
    provider: "claude-code",
    messages: session.getState().messages.slice(0, 3),
  });
  expect(other.getState().messages).toEqual([]);
});

it("ignores concurrent or blank sends and preserves accepted whitespace", async () => {
  const reply = pausedReply();
  const session = createChatSession(reply);
  await session.send("codex", " \n ");
  const sent = session.send("codex", "  first");
  await reply.waiting.ready;
  const duplicate = session.send("claude-code", "also send");
  reply.resume.release();
  await Promise.all([sent, duplicate]);

  expect(reply.stream).toHaveBeenCalledTimes(1);
  expect(session.getState().messages).toEqual([
    { role: "user", content: "  first" },
    { role: "assistant", content: "Partial reply" },
  ]);
});

it("cancels through the same signal and keeps text before cancellation", async () => {
  const reply = pausedReply();
  const session = createChatSession(reply);
  const sent = session.send("codex", "Stop after first text");
  await reply.waiting.ready;
  session.cancel();
  const whileStopping = session.send("claude-code", "Too early");
  reply.resume.release();
  await Promise.all([sent, whileStopping]);

  expect(reply.stream.mock.calls[0]?.[1]?.aborted).toBe(true);
  expect(reply.stream).toHaveBeenCalledTimes(1);
  expect(session.getState()).toEqual({
    pending: false,
    messages: [
      { role: "user", content: "Stop after first text" },
      { role: "assistant", content: "Partial" },
    ],
  });
});

it("keeps the failing provider and its partial text", async () => {
  const stream = vi.fn<ProviderChat["stream"]>(async function* () {
    yield "Partial";
    throw new ProviderChatError({ provider: "claude-code", reason: "authentication-required" });
  });
  const session = createChatSession({ stream });
  await session.send("claude-code", "Hello");

  expect(session.getState()).toEqual({
    pending: false,
    failure: { provider: "claude-code", reason: "authentication-required" },
    messages: [
      { role: "user", content: "Hello" },
      { role: "assistant", content: "Partial" },
    ],
  });
});

it("reports only the stable failure code for unexpected provider errors", async () => {
  const stream = vi.fn<ProviderChat["stream"]>(() => {
    throw new Error("raw details");
  });
  const session = createChatSession({ stream });
  await session.send("codex", "Hello");
  expect(session.getState().failure).toEqual({ provider: "codex", reason: "process-failed" });
});

it("treats cancellation reported by the provider as a regular stop", async () => {
  const stream = vi.fn<ProviderChat["stream"]>(() => {
    throw new ProviderChatError({ provider: "codex", reason: "cancelled" });
  });
  const session = createChatSession({ stream });
  await session.send("codex", "Hello");
  expect(session.getState().failure).toBeUndefined();
  expect(session.getState().pending).toBe(false);
});

it("ignores a failure that arrives after the user cancels", async () => {
  const waiting = latch();
  const resume = latch();
  const stream = vi.fn<ProviderChat["stream"]>(async function* () {
    yield "";
    waiting.release();
    await resume.ready;
    throw new Error("late provider failure");
  });
  const session = createChatSession({ stream });
  const sent = session.send("codex", "Hello");
  await waiting.ready;
  session.cancel();
  resume.release();
  await sent;
  expect(session.getState()).toEqual({
    messages: [{ role: "user", content: "Hello" }],
    pending: false,
  });
});

it("does not publish after disposal and aborts the active send", async () => {
  const reply = pausedReply();
  const session = createChatSession(reply);
  const observer = vi.fn<(state: ChatSessionState) => void>();
  session.subscribe(observer);
  const sent = session.send("codex", "Hello");
  await reply.waiting.ready;
  const before = observer.mock.calls.length;

  session.dispose();
  reply.resume.release();
  await sent;
  await session.send("codex", "After unmount");
  session.subscribe(observer);
  session.dispose();

  expect(reply.stream.mock.calls[0]?.[1]?.aborted).toBe(true);
  expect(reply.stream).toHaveBeenCalledTimes(1);
  expect(observer).toHaveBeenCalledTimes(before);
});

it("lets a view detach its subscription before the conversation changes", async () => {
  const stream = vi.fn<ProviderChat["stream"]>(async function* () {
    yield "Reply";
  });
  const session = createChatSession({ stream });
  const observer = vi.fn<(state: ChatSessionState) => void>();
  const unsubscribe = session.subscribe(observer);
  unsubscribe();
  await session.send("codex", "Hello");
  expect(observer).toHaveBeenCalledTimes(1);
});

it("skips the transport when the view disposes while receiving its first update", async () => {
  const stream = vi.fn<ProviderChat["stream"]>(async function* () {
    yield "Unexpected text";
  });
  const session = createChatSession({ stream });
  session.subscribe(({ pending }) => {
    if (pending) session.dispose();
  });
  await session.send("codex", "Hello");
  expect(stream).not.toHaveBeenCalled();
});
