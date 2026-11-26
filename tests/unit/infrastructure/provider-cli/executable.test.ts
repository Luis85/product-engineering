import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { createProviderCliChat } from "../../../../src/infrastructure/provider-cli";
import {
  npmExecutables,
  findProviderExecutable,
} from "../../../../src/infrastructure/provider-cli/executable";

it("uses a configured absolute native path before auto-discovery", async () => {
  await expect(findProviderExecutable("codex", tmpdir(), process.execPath)).resolves.toBe(
    process.execPath,
  );
});

it("finds the native path behind the Windows npm launcher for either provider", () => {
  const prefix = join(tmpdir(), "npm");

  expect(npmExecutables("claude-code", prefix, "x64")).toEqual([
    join(prefix, "node_modules", "@anthropic-ai", "claude-code", "bin", "claude.exe"),
  ]);
  expect(npmExecutables("codex", prefix, "arm64")).toContain(
    join(
      prefix,
      "node_modules",
      "@openai",
      "codex",
      "node_modules",
      "@openai",
      "codex-win32-arm64",
      "vendor",
      "aarch64-pc-windows-msvc",
      "bin",
      "codex.exe",
    ),
  );
});

it("surfaces a missing configured executable from the public chat factory", async () => {
  const executable = join(tmpdir(), randomUUID(), "codex.exe");
  const cli = createProviderCliChat({ executablePaths: { codex: executable } });
  const reply = cli.stream({ provider: "codex", messages: [{ role: "user", content: "Hello" }] });

  await expect(reply[Symbol.asyncIterator]().next()).rejects.toMatchObject({
    _tag: "ProviderChatError",
    provider: "codex",
    reason: "provider-not-found",
  });
});
