import { mkdtemp, rmdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ChatProvider, ProviderChat } from "../../application/integrations";
import { createProviderChat } from "./adapter";
import { findProviderExecutable } from "./executable";
import { runProviderProcess } from "./process";

interface ProviderCliChatOptions {
  readonly executablePaths?: Readonly<Partial<Record<ChatProvider, string>>>;
}

export function createProviderCliChat({
  executablePaths = {},
}: ProviderCliChatOptions = {}): ProviderChat {
  return createProviderChat(async function* (turn, signal) {
    const cwd = await mkdtemp(join(tmpdir(), "product-engineering-chat-"));
    try {
      const executable = await findProviderExecutable(
        turn.provider,
        cwd,
        executablePaths[turn.provider],
        signal,
      );
      yield* runProviderProcess({ ...turn, cwd, executable }, signal);
    } finally {
      await rmdir(cwd).catch(() => undefined);
    }
  });
}
