import { Schema } from "effect";
import * as fc from "fast-check";
import { expect, it } from "vitest";
import { makeSettingsCodec } from "../../../../src/domain/shell/settings-codec";
import type { SettingsFields } from "../../../../src/domain/shell/settings-codec";

type Editable = { readonly title: string; readonly enabled: boolean };
type FieldIssue = { readonly code: "title.invalid" | "enabled.invalid" };

const fields = {
  title: { schema: Schema.Trim, default: "Untitled", issue: { code: "title.invalid" } },
  enabled: {
    schema: Schema.Boolean,
    default: false,
    issue: { code: "enabled.invalid" },
    omitWhenDefault: true,
  },
} satisfies SettingsFields<Editable, FieldIssue>;

const codec = makeSettingsCodec<Editable, FieldIssue>({
  version: 3,
  fields,
  migrations: {
    1: (raw) => ({ ...raw, title: raw.legacyTitle }),
    2: (raw) => ({ ...raw, enabled: raw.enabled === "on" }),
  },
});
const defaults = { title: "Untitled", enabled: false };

it.each([undefined, null])("starts with defaults and no issue for %s", (raw) => {
  expect(codec.decode(raw)).toEqual({ settings: defaults, issues: [] });
});

it("drops unknown keys and falls back on each rejected field independently", () => {
  expect(
    codec.decode({ schemaVersion: 3, title: "  A title ", enabled: 1, extra: "ignored" }),
  ).toEqual({
    settings: { title: "A title", enabled: false },
    issues: [{ code: "enabled.invalid" }],
  });
  expect(codec.decode("invalid")).toEqual({
    settings: defaults,
    issues: [{ code: "file.invalid" }],
  });
});

it("decodes unversioned files and reports invalid versions without discarding good fields", () => {
  expect(codec.decode({ title: "Current" })).toEqual({
    settings: { title: "Current", enabled: false },
    issues: [],
  });
  expect(codec.decode({ schemaVersion: -1, title: "Current" })).toEqual({
    settings: { title: "Current", enabled: false },
    issues: [{ code: "schema.invalid" }],
  });
});

it("migrates each old version in order without changing the input object", () => {
  const raw = Object.freeze({ schemaVersion: 1, legacyTitle: "  Old title ", enabled: "on" });

  expect(codec.decode(raw)).toEqual({
    settings: { title: "Old title", enabled: true },
    issues: [],
  });
  expect(raw).toEqual({ schemaVersion: 1, legacyTitle: "  Old title ", enabled: "on" });
});

it("keeps newer files read-only", () => {
  expect(codec.decode({ schemaVersion: 11, enabled: true })).toEqual({
    settings: defaults,
    issues: [{ code: "schema.newer", version: 11 }],
    readOnlyReason: "newer-version",
  });
});

it.each(["throws", "returns a non-object", "is missing"])(
  "keeps old files read-only when a migration %s",
  (kind) => {
    const migrate = () => {
      if (kind === "throws") throw new Error("bad migration");
      return null;
    };
    const failing = makeSettingsCodec<Editable, FieldIssue>({
      version: 2,
      fields,
      migrations: kind === "is missing" ? {} : { 1: migrate },
    });
    expect(failing.decode({ schemaVersion: 1, title: "Old" })).toEqual({
      settings: defaults,
      issues: [{ code: "migration.failed", version: 1 }],
      readOnlyReason: "unreadable",
    });
  },
);

it("normalizes a patch and includes only declared fields in the encoded file", () => {
  expect(codec.validatePatch({ title: "  New ", enabled: "on", extra: 3 })).toEqual({
    patch: { title: "New" },
    issues: [{ code: "enabled.invalid" }],
  });
  expect(codec.validatePatch(null)).toEqual({ patch: {}, issues: [{ code: "file.invalid" }] });
  expect(codec.encode(defaults)).toEqual({ schemaVersion: 3, title: "Untitled" });
  expect(codec.encode({ title: "A title", enabled: true })).toEqual({
    schemaVersion: 3,
    title: "A title",
    enabled: true,
  });
});

it("decodes arbitrary inputs and reopens the canonical encoding without issues", () => {
  fc.assert(
    fc.property(fc.anything(), (raw) => {
      const { settings } = codec.decode(raw);
      expect(codec.decode(codec.encode(settings))).toEqual({ settings, issues: [] });
    }),
  );
});
