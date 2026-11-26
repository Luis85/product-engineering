import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";
import { bumpVersion, isReleaseVersion } from "../../../scripts/version-bump.mjs";

const manifest = Object.freeze({ id: "example", version: "0.9.10", minAppVersion: "1.15.1" });
const versions = Object.freeze({ "0.8.0": "1.14.0", "0.9.10": "1.14.5" });

it("sets the new version and compatibility without replacing existing entries", () => {
  expect(bumpVersion("0.10.0", manifest, versions)).toEqual({
    manifest: { ...manifest, version: "0.10.0" },
    versions: { ...versions, "0.10.0": "1.15.1" },
  });
});

it.each(["1.0.0", "0.10.0", "0.9.11", "9007199254740993.0.0"])(
  "compares components numerically for %s",
  (version) => expect(bumpVersion(version, manifest, versions).manifest.version).toBe(version),
);

it.each(["0.9.10", "0.9.9", "0.8.99", "0.0.0"])(
  "rejects a version that does not increase %s",
  (version) => {
    expect(() => bumpVersion(version, manifest, versions)).toThrow(/greater than/);
  },
);

it.each([
  "v1.0.0",
  "1.2",
  "1.2.3.4",
  "01.2.3",
  "1.02.3",
  "1.2.03",
  "-1.2.3",
  "1.2.3-beta.1",
  "1.2.3+build",
  " 1.2.3",
  "1.2.3\n",
  "",
  123,
  null,
  undefined,
])("rejects versions outside the plain x.y.z form %j", (value) => {
  expect(isReleaseVersion(value)).toBe(false);
  expect(() => bumpVersion(value, manifest, versions)).toThrow(/plain x\.y\.z/);
});

it("accepts zero components and rejects an invalid current manifest version", () => {
  expect(isReleaseVersion("0.0.0")).toBe(true);
  expect(() => bumpVersion("1.0.0", { ...manifest, version: "v0.9.10" }, versions)).toThrow(
    /manifest\.json.*plain x\.y\.z/,
  );
  const highVersion = { ...manifest, version: "9007199254740992.0.0" };
  expect(bumpVersion("9007199254740993.0.0", highVersion, versions).manifest.version).toBe(
    "9007199254740993.0.0",
  );
});

function runHook(version: string, history = JSON.stringify(versions)) {
  const fixture = mkdtempSync(join(tmpdir(), "pe-version-"));
  const files = [
    join(fixture, "package.json"),
    join(fixture, "manifest.json"),
    join(fixture, "versions.json"),
  ] as const;
  const [packageFile, manifestFile, versionsFile] = files;
  try {
    writeFileSync(packageFile, JSON.stringify({ version }));
    writeFileSync(manifestFile, JSON.stringify(manifest));
    writeFileSync(versionsFile, history);
    const script = fileURLToPath(new URL("../../../scripts/version-bump.mjs", import.meta.url));
    const run = spawnSync(process.execPath, [script], { cwd: fixture, encoding: "utf8" });
    return {
      status: run.status,
      stderr: run.stderr,
      manifest: readFileSync(manifestFile, "utf8"),
      versions: readFileSync(versionsFile, "utf8"),
    };
  } finally {
    for (const file of files) rmSync(file, { force: true });
    rmdirSync(fixture);
  }
}

it("writes two-space JSON with final newlines in the hook working directory", () => {
  const result = runHook("1.0.0");
  expect(result.status).toBe(0);
  expect(result.manifest).toBe(JSON.stringify({ ...manifest, version: "1.0.0" }, null, 2) + "\n");
  expect(result.versions).toBe(JSON.stringify({ ...versions, "1.0.0": "1.15.1" }, null, 2) + "\n");
});

it("keeps both existing files unchanged when refusing a package version or invalid version history", () => {
  const rejected = runHook("0.9.9");
  expect(rejected).toMatchObject({
    status: 1,
    manifest: JSON.stringify(manifest),
    versions: JSON.stringify(versions),
  });
  expect(rejected.stderr).toMatch(/greater than/);

  const brokenHistory = runHook("1.0.0", "[]");
  expect(brokenHistory).toMatchObject({
    status: 1,
    manifest: JSON.stringify(manifest),
    versions: "[]",
  });
  expect(brokenHistory.stderr).toMatch(/versions\.json.*object/);
});
