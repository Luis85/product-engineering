import { Schema } from "effect";
import { expect, it } from "vitest";
import {
  decodeSettings,
  encodeSettings,
  parseMcpPort,
  validatePatch,
} from "../../../../src/domain/shell";
import { CliExecutablePath, McpPort } from "../../../../src/domain/shell/agent-settings";

it.each([
  ["", 0],
  ["0", 0],
  [" 7123 ", 7123],
  ["65535", 65535],
  ["-1", undefined],
  ["65536", undefined],
  ["1.5", undefined],
  ["1e3", undefined],
])("parses the settings port %s", (draft, port) => {
  expect(parseMcpPort(draft)).toBe(port);
});

it("uses numeric, bounded ports in persisted settings", () => {
  const decode = Schema.decodeUnknownSync(McpPort);
  expect(decode(0)).toBe(0);
  expect(decode(7123)).toBe(7123);
  expect(() => decode("7123")).toThrow("Expected number");
  expect(() => decode(65536)).toThrow("Expected a value between 0 and 65535");
});

it.each([
  ["", ""],
  ["  /usr/local/bin/codex  ", "/usr/local/bin/codex"],
  ["C:\\Program Files\\Claude\\claude.exe", "C:\\Program Files\\Claude\\claude.exe"],
  ["\\\\server\\share\\codex.exe", "\\\\server\\share\\codex.exe"],
])("decodes auto-discovery or an absolute path %s", (value, path) => {
  expect(Schema.decodeUnknownSync(CliExecutablePath)(value)).toBe(path);
});

it.each(["claude", "../codex", "C:codex.exe", "~/bin/claude"])(
  "rejects a relative executable path %s",
  (value) => {
    expect(() => Schema.decodeUnknownSync(CliExecutablePath)(value)).toThrow(
      "Expected a string matching the RegExp",
    );
  },
);

it("round-trips explicit shared item IDs in selection order and omits the empty default", () => {
  const saved = decodeSettings({ mcpSharedItemIds: ["item-b", "item-a", "item-b"] });
  expect(saved.issues).toEqual([]);
  expect(saved.settings.mcpSharedItemIds).toEqual(["item-b", "item-a"]);
  expect(encodeSettings(saved.settings)).toEqual({
    schemaVersion: 1,
    logLevel: "warn",
    mcpSharedItemIds: ["item-b", "item-a"],
  });
  const empty = decodeSettings({ mcpSharedItemIds: [] });
  expect(empty.settings.mcpSharedItemIds).toBeUndefined();
  expect(encodeSettings(empty.settings)).not.toHaveProperty("mcpSharedItemIds");
  expect(validatePatch({ mcpSharedItemIds: [] })).toEqual({
    patch: { mcpSharedItemIds: undefined },
    issues: [],
  });
});

it("rejects a malformed sharing setting without recovering a partial list", () => {
  const unsafe = { mcpSharedItemIds: ["item-a", null], mcpPort: 9170 };
  const decoded = decodeSettings(unsafe);
  expect(decoded.issues).toEqual([{ code: "mcpSharedItemIds.invalid" }]);
  expect(decoded.settings).toMatchObject({ mcpPort: 9170 });
  expect(decoded.settings.mcpSharedItemIds).toBeUndefined();
  expect(validatePatch({ mcpSharedItemIds: [""] })).toEqual({
    patch: {},
    issues: [{ code: "mcpSharedItemIds.invalid" }],
  });
});
