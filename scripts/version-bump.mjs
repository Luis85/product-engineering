// @ts-check
import { randomUUID } from "node:crypto";
import { readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const releaseVersion = /^(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)$/;

/** @param {unknown} value @returns {value is string} */
export function isReleaseVersion(value) {
  return typeof value === "string" && releaseVersion.test(value);
}

/** @param {string} next @param {string} current */
function isGreaterVersion(next, current) {
  const currentParts = current.split(".");
  for (const [index, component] of next.split(".").entries()) {
    const nextNumber = BigInt(component);
    const currentNumber = BigInt(currentParts[index] ?? "0");
    if (nextNumber !== currentNumber) return nextNumber > currentNumber;
  }
  return false;
}

/**
 * @template {{readonly version: string, readonly minAppVersion: string}} Manifest
 * @param {unknown} pkgVersion
 * @param {Manifest} manifest
 * @param {Readonly<Record<string, unknown>>} versions
 * @returns {{manifest: Omit<Manifest, "version"> & {version: string}, versions: Record<string, unknown>}}
 */
export function bumpVersion(pkgVersion, manifest, versions) {
  if (!isReleaseVersion(pkgVersion)) throw new Error("package.json version must be plain x.y.z");
  if (!isReleaseVersion(manifest.version)) {
    throw new Error("manifest.json version must be plain x.y.z");
  }
  if (!isGreaterVersion(pkgVersion, manifest.version)) {
    throw new Error(
      `Package version ${pkgVersion} must be greater than manifest version ${manifest.version}`,
    );
  }

  return {
    manifest: { ...manifest, version: pkgVersion },
    versions: { ...versions, [pkgVersion]: manifest.minAppVersion },
  };
}

/** @param {string} file */
function readJsonObject(file) {
  /** @type {unknown} */
  const value = JSON.parse(readFileSync(file, "utf8"));
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${file} must contain a JSON object`);
  }
  return /** @type {Record<string, unknown>} */ (value);
}

/** @param {ReturnType<typeof bumpVersion>} next */
function writeVersionFiles(next) {
  const suffix = "." + randomUUID() + ".tmp";
  // The manifest only points to the new version once the compatibility entry exists.
  const files = [
    { path: "versions.json", value: next.versions },
    { path: "manifest.json", value: next.manifest },
  ].map(({ path, value }) => ({
    path,
    staging: path + suffix,
    text: JSON.stringify(value, null, 2) + "\n",
  }));

  try {
    for (const { staging, text } of files) writeFileSync(staging, text, { flag: "wx" });
    for (const { path, staging } of files) renameSync(staging, path);
  } finally {
    for (const { staging } of files) rmSync(staging, { force: true });
  }
}

function updateFromPackage() {
  const { version: pkgVersion } = readJsonObject("package.json");
  const manifest = readJsonObject("manifest.json");
  const versions = readJsonObject("versions.json");
  const { version, minAppVersion } = manifest;
  if (typeof version !== "string" || typeof minAppVersion !== "string") {
    throw new Error("manifest.json must declare version and minAppVersion strings");
  }

  writeVersionFiles(bumpVersion(pkgVersion, { ...manifest, version, minAppVersion }, versions));
}

const entry = process.argv[1];
if (entry && pathToFileURL(entry).href === import.meta.url) {
  try {
    updateFromPackage();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
