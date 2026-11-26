import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { browser } from "@wdio/globals";
import type { ChatProvider } from "../../src/application/integrations";

type FixturePaths = Readonly<Record<ChatProvider, string>>;
type Call = { provider: ChatProvider; input: string; aborted: boolean; released: boolean };
type ProviderWindow = Window & {
  peProviderFixture?: {
    calls: Call[];
    partial(index: number, text: string): void;
    finish(index: number, text: string): void;
    restore(): void;
  };
};

export async function createProviderFixture() {
  const vault = browser.getObsidianPage().getVaultPath();
  const folder = join(vault, ".obsidian", "plugins", "product-engineering");
  const paths: FixturePaths = {
    codex: join(folder, "fixture-codex.exe"),
    "claude-code": join(folder, "fixture-claude.exe"),
  };
  await Promise.all(
    Object.values(paths).map((path) => writeFile(path, "Controlled fixture", { mode: 0o700 })),
  );
  await installProviderFixture(paths);
  return { paths, codexPath: paths.codex, claudeCodePath: paths["claude-code"] };
}

export async function installProviderFixture(paths: FixturePaths) {
  await browser.executeObsidian(({ require }, executables) => {
    const owner = window as ProviderWindow;
    owner.peProviderFixture?.restore();
    const childProcess = require("node:child_process") as typeof import("node:child_process");
    const { EventEmitter } = require("node:events") as typeof import("node:events");
    const { PassThrough } = require("node:stream") as typeof import("node:stream");
    const original = childProcess.spawn;
    const calls: Call[] = [];
    const replies: ((text: string) => void)[] = [];
    const partials: ((text: string) => void)[] = [];

    childProcess.spawn = new Proxy(original, {
      apply(target, receiver: unknown, args: unknown[]) {
        const [file] = args;
        const provider =
          file === executables.codex
            ? "codex"
            : file === executables["claude-code"]
              ? "claude-code"
              : undefined;
        if (!provider) return Reflect.apply(target, receiver, args) as ReturnType<typeof original>;
        const call: Call = { provider, input: "", aborted: false, released: false };
        const child = Object.assign(new EventEmitter(), {
          pid: 1,
          stdin: new PassThrough(),
          stdout: new PassThrough(),
          stderr: new PassThrough(),
          exitCode: null as number | null,
          signalCode: null as NodeJS.Signals | null,
          kill() {
            call.aborted = true;
            child.signalCode = "SIGTERM";
            queueMicrotask(() => child.emit("close", null));
            return true;
          },
        });
        child.stdin.setEncoding("utf8").on("data", (input: string) => {
          call.input += input;
        });
        calls.push(call);
        partials.push((text) => {
          const event =
            provider === "codex"
              ? { type: "item.completed", item: { type: "agent_message", text } }
              : {
                  type: "stream_event",
                  event: { type: "content_block_delta", delta: { type: "text_delta", text } },
                };
          if (!child.stdout.destroyed) child.stdout.write(JSON.stringify(event) + "\n");
        });
        replies.push((text) => {
          call.released = true;
          const events =
            provider === "codex"
              ? [
                  { type: "item.completed", item: { type: "agent_message", text } },
                  { type: "turn.completed" },
                ]
              : [{ type: "result", subtype: "success", result: text }];
          if (child.stdout.destroyed) return;
          child.stdout.end(events.map((event) => JSON.stringify(event)).join("\n") + "\n");
          child.stderr.end();
          child.exitCode = 0;
          child.emit("close", 0);
        });
        return child;
      },
    });
    owner.peProviderFixture = {
      calls,
      partial(index, text) {
        const delivery = partials[index];
        if (!delivery) throw new Error("The fixture call for the partial response is missing");
        delivery(text);
      },
      finish(index, text) {
        const reply = replies[index];
        if (!reply) throw new Error("The configured fake provider call is missing");
        reply(text);
      },
      restore() {
        childProcess.spawn = original;
        delete owner.peProviderFixture;
      },
    };
  }, paths);
}

export function streamProviderText(index: number, reply: string) {
  return browser.executeObsidian(
    (_, requestIndex, response) => {
      const fixture = (window as ProviderWindow).peProviderFixture;
      if (!fixture) throw new Error("The fake provider is missing");
      fixture.partial(requestIndex, response);
    },
    index,
    reply,
  );
}

export function readProviderCalls() {
  return browser.executeObsidian(() => {
    const fixture = (window as ProviderWindow).peProviderFixture;
    if (!fixture) throw new Error("The fake provider is missing");
    return fixture.calls;
  });
}

export function finishProviderCall(index: number, reply: string) {
  return browser.executeObsidian(
    (_, requestIndex, response) => {
      const fixture = (window as ProviderWindow).peProviderFixture;
      if (!fixture) throw new Error("The fake provider is missing");
      fixture.finish(requestIndex, response);
    },
    index,
    reply,
  );
}
