// @ts-check
import { appendFileSync, readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { isGreaterVersion, isReleaseVersion } from "./version-bump.mjs";

const root = new URL("../", import.meta.url);

/** @param {string} current @param {string} request */
export function planReleaseVersion(current, request) {
  if (!isReleaseVersion(current)) throw new Error("The manifest version must be plain x.y.z");
  const [major = 0n, minor = 0n, patch = 0n] = current.split(".").map((part) => BigInt(part));
  const bumps = new Map([
    ["current", current],
    ["patch", `${major}.${minor}.${patch + 1n}`],
    ["minor", `${major}.${minor + 1n}.0`],
    ["major", `${major + 1n}.0.0`],
  ]);
  const version = bumps.get(request) ?? request;
  if (!isReleaseVersion(version))
    throw new Error("Use current, patch, minor, major, or plain x.y.z");
  if (version !== current && !isGreaterVersion(version, current)) {
    throw new Error(`Release version ${version} must be at least ${current}`);
  }
  return { current, version, versionPrRequired: version !== current };
}

/**
 * @param {string} manifestVersion
 * @param {{event: string, ref: string, version: string, prerelease: boolean, dryRun: boolean}} input
 */
export function resolveWorkflowRelease(manifestVersion, input) {
  if (input.event === "workflow_dispatch") {
    if (input.ref !== "refs/heads/main") throw new Error("Start the Release workflow on main");
    const tag = input.version === "current" ? manifestVersion : input.version;
    if (!isReleaseVersion(tag))
      throw new Error("Dispatch with current or the merged plain x.y.z version");
    if (tag !== manifestVersion)
      throw new Error(`Merge the version bump PR for ${tag} before dispatching Release`);
    return { tag, prerelease: input.prerelease, publish: !input.dryRun };
  }

  if (input.event !== "push" || !input.ref.startsWith("refs/tags/")) {
    throw new Error("Release requires a manual dispatch or a version tag");
  }
  const tag = input.ref.slice("refs/tags/".length);
  if (!isReleaseVersion(tag) || tag !== manifestVersion) {
    throw new Error("The bare release tag must match the manifest version");
  }
  return { tag, prerelease: tag.startsWith("0."), publish: true };
}

/** @param {string} file */
function readVersion(file) {
  /** @type {unknown} */
  const value = JSON.parse(readFileSync(fileURLToPath(new URL(file, root)), "utf8"));
  if (value && typeof value === "object" && "version" in value && isReleaseVersion(value.version)) {
    return value.version;
  }
  throw new Error(`${file} must declare a plain x.y.z version`);
}

function main() {
  const current = readVersion("manifest.json");
  for (const file of ["package.json", "package-lock.json"]) {
    if (readVersion(file) !== current)
      throw new Error(`${file} must match manifest.json version ${current}`);
  }
  const [request = "current"] = process.argv.slice(2);
  if (process.argv.length > 3) throw new Error("Pass one release version or --workflow");
  if (request !== "--workflow") {
    console.log(JSON.stringify(planReleaseVersion(current, request), null, 2));
    return;
  }

  const { GITHUB_EVENT_NAME, GITHUB_REF, GITHUB_OUTPUT, REQUESTED_VERSION, PRERELEASE, DRY_RUN } =
    process.env;
  if (!GITHUB_OUTPUT) throw new Error("Workflow output path is required");
  const result = resolveWorkflowRelease(current, {
    event: GITHUB_EVENT_NAME ?? "",
    ref: GITHUB_REF ?? "",
    version: REQUESTED_VERSION ?? "current",
    prerelease: PRERELEASE === "true",
    dryRun: DRY_RUN === "true",
  });
  appendFileSync(
    GITHUB_OUTPUT,
    `tag=${result.tag}\nprerelease=${result.prerelease}\npublish=${result.publish}\n`,
  );
}

const entry = process.argv[1];
if (entry && pathToFileURL(entry).href === import.meta.url) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
