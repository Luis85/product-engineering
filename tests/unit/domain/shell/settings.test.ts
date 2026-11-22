import { expect, it } from "vitest";
import type { SettingsIssue } from "../../../../src/domain/shell";
import {
  decodeSettings,
  DEFAULT_SETTINGS,
  encodeSettings,
  LOG_LEVELS,
  validatePatch,
} from "../../../../src/domain/shell";

it("declares the supported levels in severity order", () => {
  expect(LOG_LEVELS).toEqual(["error", "warn", "info", "debug"]);
  expect(DEFAULT_SETTINGS).toEqual({ logLevel: "warn", rootFolder: "Product Engineering" });
  expect(encodeSettings(DEFAULT_SETTINGS)).toEqual({ schemaVersion: 1, logLevel: "warn" });
});

it("describes an unknown level without preserving the rejected data", () => {
  const issue: SettingsIssue = { code: "logLevel.unknown", allowed: LOG_LEVELS };
  expect(decodeSettings({ logLevel: "verbose" })).toEqual({
    settings: DEFAULT_SETTINGS,
    issues: [issue],
  });
  expect(validatePatch({ logLevel: "verbose" })).toEqual({ patch: {}, issues: [issue] });
});
