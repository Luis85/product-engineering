// @ts-check
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { format, resolveConfig } from "prettier";
import { fallowConfig } from "../configs/fallow.config.mjs";
import { readModules } from "./modules.mjs";

const target = fileURLToPath(new URL("../configs/fallow.json", import.meta.url));
const stale = "configs/fallow.json does not match the module list: run `npm run fallow:config`.";

/** @typedef {Parameters<typeof fallowConfig>[0]} FallowInput */

/** @param {FallowInput} input */
export async function fallowJson(input) {
  const options = await resolveConfig(target);
  return format(JSON.stringify(fallowConfig(input)), { ...options, filepath: target });
}

const hasModuleFolder = (/** @type {string} */ folder, /** @type {string} */ module) =>
  existsSync(new URL(`../src/${folder}/${module}/`, import.meta.url));

/** @param {{check: boolean, path?: string} & Partial<FallowInput>} options */
export async function syncFallowJson({
  check,
  path = target,
  modules = readModules(),
  has = hasModuleFolder,
}) {
  const generated = await fallowJson({ modules, has });
  if (existsSync(path) && readFileSync(path, "utf8") === generated) return "";
  if (check) return stale;
  writeFileSync(path, generated);
  return "";
}

const entry = process.argv[1];
if (entry && pathToFileURL(entry).href === import.meta.url) {
  const message = await syncFallowJson({ check: process.argv.includes("--check") });
  if (message) {
    console.error(message);
    process.exitCode = 1;
  }
}
