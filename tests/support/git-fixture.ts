import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export function fixtureGitEnv(isolatedConfigPath: string) {
  const inherited = Object.fromEntries(
    Object.entries(process.env).filter(([key]) => !key.toUpperCase().startsWith("GIT_")),
  );
  return {
    ...inherited,
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_CONFIG_GLOBAL: isolatedConfigPath,
  };
}

export function gitFixture() {
  const root = mkdtempSync(join(tmpdir(), "product-views-git-"));
  const vault = join(root, "Vault with spaces");
  mkdirSync(vault);
  const env = fixtureGitEnv(join(root, "no-global-config"));
  const git = (...args: string[]) => execFileSync("git", args, { cwd: vault, env });
  const init = () => {
    git("init", "--quiet", "--initial-branch=main");
    git("config", "user.name", "Vault Fixture");
    git("config", "user.email", "fixture@example.invalid");
    git("config", "core.autocrlf", "false");
  };
  return { vault, env, git, init, close: () => rmSync(root, { recursive: true, force: true }) };
}
