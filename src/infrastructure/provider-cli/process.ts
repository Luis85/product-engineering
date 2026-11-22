import { spawn } from "node:child_process";
import type { ChildProcessWithoutNullStreams } from "node:child_process";
import type { Readable } from "node:stream";
import { clearTimeout, setTimeout } from "node:timers";
import { ProviderChatError } from "../../application/integrations";
import type { ChatProvider } from "../../application/integrations";
import { failureReason } from "./protocol";
import type { ProviderTurn } from "./protocol";

interface ProcessTurn extends ProviderTurn {
  readonly executable: string;
  readonly cwd?: string;
}

const maximumLineLength = 2 * 1024 * 1024;
const maximumErrorLength = 4096;

function validateLineLength(line: string, provider: ChatProvider): void {
  if (line.length > maximumLineLength) {
    throw new ProviderChatError({ provider, reason: "invalid-response" });
  }
}

function parseLine(line: string, provider: ChatProvider): unknown {
  validateLineLength(line, provider);
  try {
    return JSON.parse(line) as unknown;
  } catch {
    const reason =
      failureReason(line) === "authentication-required"
        ? "authentication-required"
        : "invalid-response";
    throw new ProviderChatError({ provider, reason });
  }
}

async function* parsedOutput(output: Readable, provider: ChatProvider): AsyncIterable<unknown> {
  let remainder = "";
  for await (const chunk of output.setEncoding("utf8")) {
    if (typeof chunk !== "string") continue;
    const lines = (remainder + chunk).split("\n");
    remainder = lines.pop() ?? "";
    validateLineLength(remainder, provider);
    for (const line of lines) {
      if (line.trim()) yield parseLine(line, provider);
    }
  }
  if (remainder.trim()) yield parseLine(remainder, provider);
}

function watchChild(child: ChildProcessWithoutNullStreams) {
  let stderr = "";
  let errno: string | undefined;
  const closed = new Promise<{ code: number | null; errno: string | undefined; stderr: string }>(
    (resolve) => {
      child.stderr.setEncoding("utf8").on("data", (value: unknown) => {
        if (typeof value === "string") stderr = (stderr + value).slice(-maximumErrorLength);
      });
      child.on("error", (error: NodeJS.ErrnoException) => {
        errno = error.code ?? "unknown";
      });
      child.once("close", (code) => resolve({ code, errno, stderr }));
    },
  );

  // A CLI can exit before it has read its input. Its result carries the failure.
  child.stdin.on("error", () => undefined);

  let forceKill: ReturnType<typeof setTimeout> | undefined;
  const terminate = (): void => {
    if (
      child.exitCode === null &&
      child.signalCode === null &&
      child.pid !== undefined &&
      !forceKill
    ) {
      child.kill();
      forceKill = setTimeout(() => child.kill("SIGKILL"), 1000);
      forceKill.unref();
    }
    child.stdout.destroy();
    child.stderr.destroy();
    child.stdin.destroy();
  };

  return {
    closed,
    terminate,
    async dispose() {
      terminate();
      await closed;
      clearTimeout(forceKill);
    },
  };
}

function checkExit(
  exit: Awaited<ReturnType<typeof watchChild>["closed"]>,
  provider: ChatProvider,
): void {
  if (exit.errno === "ENOENT")
    throw new ProviderChatError({ provider, reason: "provider-not-found" });
  if (exit.code !== 0 || exit.errno) {
    throw new ProviderChatError({ provider, reason: failureReason(exit.stderr) });
  }
}

export async function* runProviderProcess(
  turn: ProcessTurn,
  signal?: AbortSignal,
): AsyncIterable<unknown> {
  const { provider, executable, args, stdin, cwd } = turn;
  if (signal?.aborted) throw new ProviderChatError({ provider, reason: "cancelled" });
  const child = spawn(executable, args, { cwd, stdio: "pipe", shell: false, windowsHide: true });
  const watcher = watchChild(child);

  signal?.addEventListener("abort", watcher.terminate, { once: true });
  child.stdin.end(stdin);
  try {
    yield* parsedOutput(child.stdout, provider);
    const exit = await watcher.closed;
    if (signal?.aborted) throw new ProviderChatError({ provider, reason: "cancelled" });
    checkExit(exit, provider);
  } catch (error) {
    if (signal?.aborted) throw new ProviderChatError({ provider, reason: "cancelled" });
    if (error instanceof ProviderChatError) throw error;
    throw new ProviderChatError({ provider, reason: "process-failed" });
  } finally {
    signal?.removeEventListener("abort", watcher.terminate);
    await watcher.dispose();
  }
}
