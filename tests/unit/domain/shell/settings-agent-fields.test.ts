import { expect, it } from "vitest";
import {
  decodeSettings,
  DEFAULT_SETTINGS,
  encodeSettings,
  validatePatch,
} from "../../../../src/domain/shell";

const configured = {
  logLevel: "info",
  mcpPort: 8123,
  claudeCodePath: "C:/Program Files/Claude/claude.exe",
  codexPath: "/usr/local/bin/codex",
} as const;

it("preserves the existing version 1 shape when agent settings are absent", () => {
  expect(DEFAULT_SETTINGS).toStrictEqual({ logLevel: "warn" });
  const stored = { schemaVersion: 1, logLevel: "debug" };
  const { settings, issues } = decodeSettings(stored);
  expect(settings).toStrictEqual({ logLevel: "debug" });
  expect(issues).toEqual([]);
  expect(encodeSettings(settings)).toStrictEqual(stored);
});

it("persists an explicit port and tool paths after independent trimming", () => {
  const stored = {
    schemaVersion: 1,
    ...configured,
    claudeCodePath: "  C:/Program Files/Claude/claude.exe  ",
    codexPath: " /usr/local/bin/codex ",
  };
  expect(decodeSettings(stored)).toStrictEqual({ settings: configured, issues: [] });
  expect(encodeSettings(configured)).toStrictEqual({ schemaVersion: 1, ...configured });
  expect(encodeSettings({ ...configured, mcpPort: 0 })).toStrictEqual({
    schemaVersion: 1,
    ...configured,
    mcpPort: 0,
  });
});

it.each([
  ["mcpPort", "8123", "mcpPort.invalid"],
  ["claudeCodePath", "../claude", "claudeCodePath.invalid"],
  ["codexPath", "~/bin/codex", "codexPath.invalid"],
] as const)("falls back only for an invalid %s", (field, invalidValue, code) => {
  const expected = Object.fromEntries(Object.entries(configured).filter(([key]) => key !== field));
  expect(decodeSettings({ schemaVersion: 1, ...configured, [field]: invalidValue })).toStrictEqual({
    settings: expected,
    issues: [{ code }],
  });
});

it("validates provided fields independently", () => {
  const { patch, issues } = validatePatch({
    mcpPort: 65536,
    claudeCodePath: "  /opt/claude  ",
    codexPath: "codex",
  });
  expect(patch).toStrictEqual({ claudeCodePath: "/opt/claude" });
  expect(issues).toStrictEqual([{ code: "mcpPort.invalid" }, { code: "codexPath.invalid" }]);
  expect(validatePatch({})).toStrictEqual({ patch: {}, issues: [] });
});

it("clears settings with an explicit unset port and blank executable fields", () => {
  const { settings } = decodeSettings({ schemaVersion: 1, ...configured });
  const { patch, issues } = validatePatch({
    mcpPort: undefined,
    claudeCodePath: " ",
    codexPath: "",
  });
  expect(issues).toEqual([]);
  expect(patch).toStrictEqual({
    mcpPort: undefined,
    claudeCodePath: undefined,
    codexPath: undefined,
  });
  const stored = encodeSettings({ ...settings, ...patch });
  expect(stored).toStrictEqual({ schemaVersion: 1, logLevel: "info" });
  expect(decodeSettings(stored).settings).toStrictEqual({ logLevel: "info" });
});

it("represents persisted blank paths as absent auto-discovery settings", () => {
  const decoded = decodeSettings({
    schemaVersion: 1,
    logLevel: "debug",
    claudeCodePath: "",
    codexPath: " ",
  });
  expect(decoded).toStrictEqual({ settings: { logLevel: "debug" }, issues: [] });
});
