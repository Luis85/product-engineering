import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { runProviderProcess } from "../../../../src/infrastructure/provider-cli/process";

function nodeTurn(script: string, stdin = "") {
  return { provider: "codex" as const, executable: process.execPath, args: ["-e", script], stdin };
}

async function collect(stream: AsyncIterable<unknown>): Promise<unknown[]> {
  const result: unknown[] = [];
  for await (const event of stream) result.push(event);
  return result;
}

describe("provider process", () => {
  it("passes stdin unchanged and parses UTF-8 JSON lines with or without a final newline", async () => {
    const prompt = "a user prompt\nwith a line break and 🧪";
    const turn = nodeTurn(
      `let input = "";
      process.stdin.setEncoding("utf8");
      process.stdin.on("data", (chunk) => input += chunk);
      process.stdin.on("end", () => {
        process.stdout.write(JSON.stringify({ input }) + "\\r\\n\\r\\n");
        process.stdout.write(JSON.stringify({ done: true }));
      });`,
      prompt,
    );

    await expect(collect(runProviderProcess(turn))).resolves.toEqual([
      { input: prompt },
      { done: true },
    ]);
  });

  it("classifies an executable missing from the system", async () => {
    const executable = join(tmpdir(), randomUUID(), "missing");
    await expect(
      collect(runProviderProcess({ ...nodeTurn(""), executable })),
    ).rejects.toMatchObject({
      reason: "provider-not-found",
    });
  });

  it.each([
    ["Not logged in. Please run codex login. secret", "authentication-required"],
    ["Backend returned a private error", "process-failed"],
  ])("uses a stable exit failure reason for %s", async (stderr, reason) => {
    const turn = nodeTurn(`process.stderr.write(${JSON.stringify(stderr)}); process.exitCode = 2;`);
    const promise = collect(runProviderProcess(turn));
    await expect(promise).rejects.toMatchObject({ reason });
    await expect(promise).rejects.not.toHaveProperty("cause");
  });

  it("rejects malformed JSON without including the contents in the failure", async () => {
    const turn = nodeTurn('process.stdout.write("unknown payload\\n");');
    const result = collect(runProviderProcess(turn));
    await expect(result).rejects.toMatchObject({ reason: "invalid-response" });
    await expect(result).rejects.not.toHaveProperty("cause");
  });

  it("bounds the size of an unterminated event", async () => {
    const turn = nodeTurn('process.stdout.write("x".repeat(2 * 1024 * 1024 + 1));');
    await expect(collect(runProviderProcess(turn))).rejects.toMatchObject({
      reason: "invalid-response",
    });
  });

  it("does not start a process for a request that has already been cancelled", async () => {
    const turn = nodeTurn("process.exitCode = 75;");
    await expect(collect(runProviderProcess(turn, AbortSignal.abort()))).rejects.toMatchObject({
      reason: "cancelled",
    });
  });

  it("terminates the child if the request is cancelled while it is running", async () => {
    const turn = nodeTurn(
      'process.stdout.write("{\\"ready\\":true}\\n"); setInterval(() => {}, 30000);',
    );
    const cancellation = new AbortController();
    const stream = runProviderProcess(turn, cancellation.signal)[Symbol.asyncIterator]();
    await expect(stream.next()).resolves.toMatchObject({ value: { ready: true } });

    cancellation.abort();

    await expect(stream.next()).rejects.toMatchObject({ reason: "cancelled" });
  });

  it("terminates the child when the consumer stops iterating", async () => {
    const turn = nodeTurn(
      'process.stdout.write("{\\"ready\\":true}\\n"); setInterval(() => {}, 30000);',
    );
    const stream = runProviderProcess(turn)[Symbol.asyncIterator]();
    await expect(stream.next()).resolves.toMatchObject({ value: { ready: true } });
    await expect(stream.return?.()).resolves.toMatchObject({ done: true });
  });
});
