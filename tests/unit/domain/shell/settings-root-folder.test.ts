import { expect, it } from "vitest";
import { decodeSettings, encodeSettings, validatePatch } from "../../../../src/domain/shell";

it("defaults to Product Engineering without storing the default folder", () => {
  const decoded = decodeSettings({ logLevel: "info" });
  expect(decoded).toEqual({
    settings: { logLevel: "info", rootFolder: "Product Engineering" },
    issues: [],
  });
  expect(encodeSettings(decoded.settings)).toEqual({ schemaVersion: 1, logLevel: "info" });
});

it("normalizes a folder path before saving it", () => {
  const patch = validatePatch({ rootFolder: " /Topics/Pe\u0301quipe/  " });
  expect(patch).toEqual({ patch: { rootFolder: "Topics/Péquipe" }, issues: [] });
  const decoded = decodeSettings({ rootFolder: " /Topics/Pe\u0301quipe/  " });
  expect(encodeSettings(decoded.settings)).toEqual({
    schemaVersion: 1,
    logLevel: "warn",
    rootFolder: "Topics/Péquipe",
  });
});

it.each([
  "",
  "/",
  "Teams//Projects",
  "Teams/ /Projects",
  ".obsidian/Projects",
  "Teams/../Projects",
  "Teams/.hidden",
  "Team\\Project",
  "Team*Project",
  'Team"Project',
  "Team<Projects",
  "Team>Projects",
  "Team:Projects",
  "Team|Projects",
  "Team?Projects",
  "Team\u0000Project",
  "X".repeat(101),
])("falls back on an invalid root folder %j without losing the log level", (rootFolder) => {
  const issue = { code: "rootFolder.invalid", max: 100 };
  expect(decodeSettings({ rootFolder, logLevel: "debug" })).toEqual({
    settings: { rootFolder: "Product Engineering", logLevel: "debug" },
    issues: [issue],
  });
  expect(validatePatch({ rootFolder })).toEqual({ patch: {}, issues: [issue] });
});
