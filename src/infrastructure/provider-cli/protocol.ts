import { ProviderChatError } from "../../application/integrations";
import type { ChatFailure, ChatProvider } from "../../application/integrations";

export interface ProviderTurn {
  readonly provider: ChatProvider;
  readonly args: readonly string[];
  readonly stdin: string;
}

export type ProviderRun = (turn: ProviderTurn, signal?: AbortSignal) => AsyncIterable<unknown>;

const codexArgs = [
  "--ask-for-approval",
  "never",
  "--disable",
  "shell_tool",
  "--disable",
  "apps",
  "--disable",
  "plugins",
  "--disable",
  "memories",
  "--disable",
  "request_permissions_tool",
  "-c",
  'web_search="disabled"',
  "-c",
  "mcp_servers={}",
  "exec",
  "--ignore-user-config",
  "--json",
  "--ephemeral",
  "--sandbox",
  "read-only",
  "--skip-git-repo-check",
  "-",
] as const;

const claudeArgs = [
  "--print",
  "--output-format",
  "stream-json",
  "--input-format",
  "text",
  "--verbose",
  "--include-partial-messages",
  "--restricted",
  "--disable-slash-commands",
  "--no-session-persistence",
  "--no-chrome",
  "--tools",
  "",
  "--disallowed-tools",
  "*",
  "--strict-mcp-config",
  "--mcp-config",
  '{"mcpServers":{}}',
  "--settings",
  '{"disableAllHooks":true}',
  "--max-turns",
  "1",
] as const;

export function providerTurn(provider: ChatProvider, stdin: string): ProviderTurn {
  return { provider, args: provider === "codex" ? codexArgs : claudeArgs, stdin };
}

export function failureReason(details: string): ChatFailure {
  const auth =
    /not logged in|please (?:run [^\r\n]{0,24}login|sign in)|authentication[ _-](?:required|error|failed)|unauthorized|invalid (?:api key|credentials)|oauth [^\r\n]{0,30}expired|\b401\b/i;
  return auth.test(details) ? "authentication-required" : "process-failed";
}

function record(input: unknown): Record<string, unknown> | undefined {
  if (typeof input === "object" && input !== null && !Array.isArray(input)) {
    return input as Record<string, unknown>;
  }
}

function failureDetails(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.filter((entry) => typeof entry === "string").join("\n");
  const message = record(value)?.message;
  return typeof message === "string" ? message : "";
}

function claudeDelta(payload: Record<string, unknown>): string | undefined {
  if (payload.type !== "stream_event" || payload.parent_tool_use_id) return;
  const event = record(payload.event);
  if (event?.type !== "content_block_delta") return;
  const delta = record(event.delta);
  if (delta?.type === "text_delta" && typeof delta.text === "string") return delta.text;
}

function claudeResult(event: Record<string, unknown>): string | undefined {
  if (event.is_error || event.subtype !== "success") {
    const details = [event.errors, event.result, event.subtype].map(failureDetails).join("\n");
    throw new ProviderChatError({ provider: "claude-code", reason: failureReason(details) });
  }
  return typeof event.result === "string" ? event.result : undefined;
}

async function* claudeText(events: AsyncIterable<unknown>): AsyncIterable<string> {
  let emitted = false;
  let finished = false;
  for await (const input of events) {
    if (finished) continue;
    const event = record(input);
    if (!event) continue;
    if (event.type === "result") {
      const result = claudeResult(event);
      if (!emitted && result) yield result;
      finished = true;
      continue;
    }
    const delta = claudeDelta(event);
    if (delta) {
      emitted = true;
      yield delta;
    }
  }
  if (!finished)
    throw new ProviderChatError({ provider: "claude-code", reason: "invalid-response" });
}

function codexMessage(event: Record<string, unknown>): string | undefined {
  if (event.type !== "item.completed") return;
  const item = record(event.item);
  if (item?.type === "agent_message" && typeof item.text === "string") return item.text;
}

async function* codexText(events: AsyncIterable<unknown>): AsyncIterable<string> {
  let emitted = false;
  let finished = false;
  let failure: ChatFailure = "invalid-response";
  for await (const input of events) {
    const event = record(input);
    if (!event) continue;
    if (event.type === "turn.failed") {
      throw new ProviderChatError({
        provider: "codex",
        reason: failureReason(failureDetails(event.error)),
      });
    }
    if (event.type === "error") failure = failureReason(failureDetails(event.message));
    if (event.type === "turn.completed") finished = true;
    const content = codexMessage(event);
    if (!content) continue;
    yield emitted ? "\n\n" + content : content;
    emitted = true;
  }
  if (!finished) throw new ProviderChatError({ provider: "codex", reason: failure });
}

export function providerText(
  provider: ChatProvider,
  events: AsyncIterable<unknown>,
): AsyncIterable<string> {
  return provider === "codex" ? codexText(events) : claudeText(events);
}
