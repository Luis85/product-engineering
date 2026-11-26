// @ts-check
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

/** @typedef {(args: string[]) => {status: number | null, stdout: string | null}} Git */

/** @param {NodeJS.ProcessEnv} env @param {Git} git */
export function installHooks(env, git) {
  if (env.CI || env.TF_BUILD || env.GITHUB_ACTIONS) return "skipped: CI";

  const workTree = git(["rev-parse", "--is-inside-work-tree"]);
  if (workTree.status !== 0 || workTree.stdout?.trim() !== "true") return "skipped: no git";

  const config = git(["config", "core.hooksPath", ".githooks"]);
  if (config.status !== 0) throw new Error("Git could not configure core.hooksPath");
  return "installed";
}

const entry = process.argv[1];
if (entry && pathToFileURL(entry).href === import.meta.url) {
  const result = installHooks(process.env, (args) => spawnSync("git", args, { encoding: "utf8" }));
  console.log(result);
}
