// @ts-check
import {
  copyFileSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { checkDist, CSS_PREFIX } from "./check-dist.mjs";
import { NOTICES_FILE } from "./third-party-notices.mjs";
import { isReleaseVersion } from "./version-bump.mjs";

export const RELEASE_FILES = ["main.js", "manifest.json", "styles.css"];
const root = fileURLToPath(new URL("../", import.meta.url));

/** @param {string} path */
function readObject(path) {
  /** @type {unknown} */
  const parsed = JSON.parse(readFileSync(path, "utf8"));
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error(path + " must contain a JSON object");
  }
  return /** @type {Readonly<Record<string, unknown>>} */ (parsed);
}

/** @param {string} rootDir @param {string | undefined} tag */
function releaseIdentity(rootDir, tag) {
  const manifest = readObject(join(rootDir, "manifest.json"));
  const { id, version, minAppVersion } = manifest;
  if (typeof id !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) {
    throw new Error("The root manifest has an invalid plugin ID");
  }
  if (!isReleaseVersion(version) || !isReleaseVersion(minAppVersion)) {
    throw new Error("The root manifest requires plain version numbers");
  }
  if (tag !== undefined) {
    if (!isReleaseVersion(tag)) throw new Error("The tag must be a plain x.y.z version");
    if (tag !== version) throw new Error("The tag does not match the manifest version");
  }
  const versions = readObject(join(rootDir, "versions.json"));
  if (versions[version] !== minAppVersion) {
    throw new Error("versions.json must map the manifest version to its minAppVersion");
  }
  return { id, manifest };
}

/** @param {string} directory @param {unknown} manifest @param {string} id */
function assertDistribution(directory, manifest, id) {
  const problems = checkDist(directory, manifest, { id, prefix: CSS_PREFIX });
  if (problems.length > 0) throw new Error(problems.join("\n"));
}

/** @param {string} pluginDirectory @param {string} noticesFile */
function assertDestinations(pluginDirectory, noticesFile) {
  const plugin = lstatSync(pluginDirectory, { throwIfNoEntry: false });
  if (plugin && !plugin.isDirectory())
    throw new Error("Invalid release directory " + pluginDirectory);
  if (plugin) {
    for (const file of readdirSync(pluginDirectory, { withFileTypes: true })) {
      if (!file.isFile() || !RELEASE_FILES.includes(file.name)) {
        throw new Error("Unexpected release file " + file.name);
      }
    }
  }
  const notices = lstatSync(noticesFile, { throwIfNoEntry: false });
  if (notices && !notices.isFile()) throw new Error("Invalid release notices path " + noticesFile);
}

class FailedRollback extends AggregateError {}

/** @param {string} staging @param {string} outDir @param {readonly string[]} names */
function publish(staging, outDir, names) {
  /** @type {Array<() => void>} */
  const undo = [];
  try {
    for (const name of names) {
      const target = join(outDir, name);
      const prepared = join(staging, name);
      const backup = join(staging, "previous-" + name);
      if (lstatSync(target, { throwIfNoEntry: false })) {
        renameSync(target, backup);
        undo.push(() => renameSync(backup, target));
      }
      renameSync(prepared, target);
      undo.push(() => renameSync(target, prepared));
    }
  } catch (error) {
    const failures = [error];
    for (const rollback of undo.toReversed()) {
      try {
        rollback();
      } catch (cause) {
        failures.push(cause);
      }
    }
    if (failures.length > 1) {
      throw new FailedRollback(failures, "Release recovery files remain in " + staging);
    }
    throw error;
  }
}

/** @param {{distDir: string, outDir: string, rootDir: string, tag?: string}} options */
export function packageRelease({ distDir, outDir, rootDir, tag }) {
  const { id, manifest } = releaseIdentity(rootDir, tag);
  assertDistribution(distDir, manifest, id);
  const notices = readFileSync(join(rootDir, NOTICES_FILE));
  if (notices.toString("utf8").trim() === "") throw new Error(NOTICES_FILE + " is empty");

  const output = resolve(outDir);
  const pluginDirectory = join(output, id);
  const noticesFile = join(output, NOTICES_FILE);
  const staging = join(output, ".package-staging");
  mkdirSync(output, { recursive: true });
  mkdirSync(staging);
  let preserveStage = false;
  try {
    assertDestinations(pluginDirectory, noticesFile);
    const stagedPlugin = join(staging, id);
    mkdirSync(stagedPlugin);
    for (const file of RELEASE_FILES) copyFileSync(join(distDir, file), join(stagedPlugin, file));
    assertDistribution(stagedPlugin, manifest, id);
    writeFileSync(join(staging, NOTICES_FILE), notices);
    publish(staging, output, [id, NOTICES_FILE]);
  } catch (error) {
    preserveStage = error instanceof FailedRollback;
    throw error;
  } finally {
    if (!preserveStage) rmSync(staging, { recursive: true });
  }

  return { pluginDirectory, noticesFile };
}

const entry = process.argv[1];
if (entry && pathToFileURL(entry).href === import.meta.url) {
  try {
    const { values } = parseArgs({ options: { tag: { type: "string" } } });
    const result = packageRelease({
      rootDir: root,
      distDir: join(root, "dist"),
      outDir: join(root, "release"),
      ...(values.tag === undefined ? {} : { tag: values.tag }),
    });
    console.log("Release packaged in " + result.pluginDirectory);
    console.log("Third-party notices at " + result.noticesFile);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
