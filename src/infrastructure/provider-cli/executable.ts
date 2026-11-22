import { execFile } from "node:child_process";
import { constants } from "node:fs";
import { access, stat } from "node:fs/promises";
import { arch, homedir, platform } from "node:os";
import { dirname, extname, isAbsolute, join } from "node:path";
import { promisify } from "node:util";
import { ProviderChatError } from "../../application/integrations";
import type { ChatProvider } from "../../application/integrations";

const execFileAsync = promisify(execFile);
const names = { "claude-code": "claude", codex: "codex" } satisfies Record<ChatProvider, string>;

async function isExecutable(path: string): Promise<boolean> {
  try {
    await access(path, constants.X_OK);
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
}

export function npmExecutables(
  provider: ChatProvider,
  prefix: string,
  architecture: string,
): string[] {
  const modules = join(prefix, "node_modules");
  if (provider === "claude-code") {
    return [join(modules, "@anthropic-ai", "claude-code", "bin", "claude.exe")];
  }

  const target =
    architecture === "x64" ? "x86_64" : architecture === "arm64" ? "aarch64" : undefined;
  if (!target) return [];
  const vendor = ["vendor", target + "-pc-windows-msvc", "bin", "codex.exe"];
  const optionalPackage = "@openai/codex-win32-" + architecture;
  const launcher = join(modules, "@openai", "codex");
  return [
    join(launcher, "node_modules", optionalPackage, ...vendor),
    join(modules, optionalPackage, ...vendor),
    join(launcher, ...vendor),
  ];
}

async function windowsMatches(name: string, cwd: string, signal?: AbortSignal): Promise<string[]> {
  try {
    const { stdout } = await execFileAsync("where.exe", [name], {
      cwd,
      signal,
      windowsHide: true,
    });
    return stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(isAbsolute);
  } catch {
    return [];
  }
}

async function firstExecutable(candidates: readonly string[]): Promise<string | undefined> {
  const checks = await Promise.all(candidates.map(isExecutable));
  const index = checks.indexOf(true);
  return candidates[index];
}

async function findOnWindows(
  provider: ChatProvider,
  cwd: string,
  signal?: AbortSignal,
): Promise<string | undefined> {
  const name = names[provider];
  const paths = await windowsMatches(name, cwd, signal);
  const installed = paths.flatMap((path) => {
    switch (extname(path).toLowerCase()) {
      case ".exe":
        return [path];
      case ".cmd":
        return npmExecutables(provider, dirname(path), arch());
      default:
        return [];
    }
  });
  return firstExecutable([
    ...installed,
    join(homedir(), ".local", "bin", name + ".exe"),
    ...npmExecutables(provider, join(homedir(), "AppData", "Roaming", "npm"), arch()),
  ]);
}

async function configuredExecutable(
  provider: ChatProvider,
  path: string,
  windows: boolean,
): Promise<string> {
  const nativePath = isAbsolute(path) && (!windows || extname(path).toLowerCase() === ".exe");
  if (nativePath && (await isExecutable(path))) return path;
  throw new ProviderChatError({ provider, reason: "provider-not-found" });
}

export async function findProviderExecutable(
  provider: ChatProvider,
  cwd: string,
  configured?: string,
  signal?: AbortSignal,
): Promise<string> {
  const windows = platform() === "win32";
  if (configured !== undefined) {
    return configuredExecutable(provider, configured, windows);
  }
  if (windows) {
    const executable = await findOnWindows(provider, cwd, signal);
    if (signal?.aborted) throw new ProviderChatError({ provider, reason: "cancelled" });
    if (executable) return executable;
    throw new ProviderChatError({ provider, reason: "provider-not-found" });
  }

  const name = names[provider];
  const fallback = await firstExecutable([
    join(homedir(), ".local", "bin", name),
    join("/opt/homebrew/bin", name),
    join("/usr/local/bin", name),
  ]);
  return fallback ?? name;
}
