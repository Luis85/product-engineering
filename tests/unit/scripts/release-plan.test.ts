import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { parse } from "yaml";
import { planReleaseVersion, resolveWorkflowRelease } from "../../../scripts/release-plan.mjs";

it("defaults to the current stable version and keeps dry runs out of the publishing job", () => {
  const workflow: unknown = parse(
    readFileSync(new URL("../../../.github/workflows/release.yml", import.meta.url), "utf8"),
  );

  expect(workflow).toMatchObject({
    on: {
      workflow_dispatch: {
        inputs: {
          version: { default: "current" },
          prerelease: { type: "boolean", default: false },
          dry_run: { type: "boolean", default: false },
        },
      },
    },
    permissions: { contents: "read" },
    jobs: {
      release: { needs: "build", if: "needs.build.outputs.publish == 'true'" },
    },
  });
});

it.each([
  ["current", "0.1.0", false],
  ["patch", "0.1.1", true],
  ["minor", "0.2.0", true],
  ["major", "1.0.0", true],
  ["1.2.3", "1.2.3", true],
])("plans %s as %s without changing the current version", (request, version, versionPrRequired) => {
  expect(planReleaseVersion("0.1.0", request)).toEqual({
    current: "0.1.0",
    version,
    versionPrRequired,
  });
});

const manual = {
  event: "workflow_dispatch",
  ref: "refs/heads/main",
  version: "current",
  prerelease: false,
  dryRun: false,
};

it("publishes a normal release for current and withholds publication for a dry run", () => {
  expect(resolveWorkflowRelease("0.1.0", manual)).toEqual({
    tag: "0.1.0",
    prerelease: false,
    publish: true,
  });
  expect(resolveWorkflowRelease("0.1.0", { ...manual, dryRun: true, prerelease: true })).toEqual({
    tag: "0.1.0",
    prerelease: true,
    publish: false,
  });
});

it("requires a merged bump and restricts manual dispatch to main", () => {
  expect(() => resolveWorkflowRelease("0.1.0", { ...manual, version: "0.2.0" })).toThrow(
    /Merge the version bump PR/,
  );
  expect(() => resolveWorkflowRelease("0.1.0", { ...manual, ref: "refs/heads/topic" })).toThrow(
    /on main/,
  );
  expect(() => planReleaseVersion("0.1.0", "0.0.9")).toThrow(/must be at least/);
  expect(() => planReleaseVersion("0.1.0", "v0.2.0")).toThrow(/plain x.y.z/);
});

it("keeps bare tag publications compatible and rejects mismatched tags", () => {
  const tagged = { ...manual, event: "push", ref: "refs/tags/0.1.0" };
  expect(resolveWorkflowRelease("0.1.0", tagged)).toEqual({
    tag: "0.1.0",
    prerelease: true,
    publish: true,
  });
  expect(() => resolveWorkflowRelease("0.2.0", tagged)).toThrow(/must match the manifest/);
  expect(resolveWorkflowRelease("1.0.0", { ...tagged, ref: "refs/tags/1.0.0" })).toMatchObject({
    prerelease: false,
    publish: true,
  });
});
