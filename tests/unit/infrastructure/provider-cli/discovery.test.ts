import { dirname, join } from "node:path";
import { beforeEach, expect, it, vi } from "vitest";
import { findProviderExecutable } from "../../../../src/infrastructure/provider-cli/executable";

const mocked = vi.hoisted(() => ({
  platform: vi.fn<() => NodeJS.Platform>(),
  execute: vi.fn<(name: string, args: string[]) => Promise<{ stdout: string }>>(),
  access: vi.fn<(path: string) => Promise<void>>(),
}));

vi.mock("node:os", async (importOriginal) => ({
  ...(await importOriginal<typeof import("node:os")>()),
  platform: mocked.platform,
  homedir: () => "test-home",
  arch: () => "x64",
}));

vi.mock("node:child_process", async () => {
  const { promisify } = await import("node:util");
  return {
    execFile: Object.assign(() => undefined, { [promisify.custom]: mocked.execute }),
  };
});

vi.mock("node:fs/promises", () => ({
  access: mocked.access,
  stat: () => Promise.resolve({ isFile: () => true }),
}));

const root = dirname(process.execPath);
const workingDir = join(root, "private working folder");
const native = join(root, "native", "codex.exe");
const shim = join(root, "npm", "codex.cmd");
const vendor = join(
  dirname(shim),
  "node_modules",
  "@openai",
  "codex",
  "vendor",
  "x86_64-pc-windows-msvc",
  "bin",
  "codex.exe",
);

function available(file: string) {
  mocked.access.mockImplementation((candidate) =>
    candidate === file ? Promise.resolve() : Promise.reject(new Error("missing")),
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  mocked.platform.mockReturnValue("win32");
  mocked.execute.mockResolvedValue({ stdout: "" });
});

it("prefers the first Windows PATH installation and resolves its native binary", async () => {
  mocked.execute.mockResolvedValue({ stdout: shim + "\r\n" + native });
  mocked.access.mockImplementation((path) =>
    [vendor, native].includes(path) ? Promise.resolve() : Promise.reject(new Error("missing")),
  );

  await expect(findProviderExecutable("codex", workingDir)).resolves.toBe(vendor);
  expect(mocked.execute).toHaveBeenCalledWith(
    "where.exe",
    ["codex"],
    expect.objectContaining({
      cwd: workingDir,
      windowsHide: true,
    }),
  );
});

it("continues on Windows when an earlier launcher has no native binary", async () => {
  mocked.execute.mockResolvedValue({ stdout: shim + "\r\n" + native });
  available(native);

  await expect(findProviderExecutable("codex", workingDir)).resolves.toBe(native);
});

it("reports an unavailable provider when Windows discovery finds no installation", async () => {
  mocked.execute.mockRejectedValue(new Error("missing where result"));
  available("none");

  await expect(findProviderExecutable("codex", workingDir)).rejects.toMatchObject({
    reason: "provider-not-found",
  });
});

it("classifies a cancelled Windows executable lookup", async () => {
  mocked.execute.mockRejectedValue(new Error("cancelled"));

  await expect(
    findProviderExecutable("codex", workingDir, undefined, AbortSignal.abort()),
  ).rejects.toMatchObject({
    reason: "cancelled",
  });
});

it("supports a user-installed Claude binary and PATH fallback outside Windows", async () => {
  mocked.platform.mockReturnValue("darwin");
  const userInstalled = join("test-home", ".local", "bin", "claude");
  available(userInstalled);
  await expect(findProviderExecutable("claude-code", workingDir)).resolves.toBe(userInstalled);

  available("none");
  await expect(findProviderExecutable("claude-code", workingDir)).resolves.toBe("claude");
});

it("rejects a relative name as an explicit executable path", async () => {
  await expect(findProviderExecutable("codex", workingDir, "codex")).rejects.toMatchObject({
    reason: "provider-not-found",
  });
  expect(mocked.access).not.toHaveBeenCalled();
});
