import { expect, it } from "vitest";
import { decodeSettings, DEFAULT_SETTINGS } from "../../../../src/domain/shell";

it.each([
  [{ logLevel: "debug", dismissCount: 4 }, "debug"],
  [{ schemaVersion: 1, logLevel: "error", deprecated: true }, "error"],
])("loads old settings %j per field", (input, logLevel) => {
  expect(decodeSettings(input)).toEqual({
    settings: { ...DEFAULT_SETTINGS, logLevel },
    issues: [],
  });
});
