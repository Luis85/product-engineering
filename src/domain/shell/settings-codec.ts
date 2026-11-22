import { Schema } from "effect";

export const StructuralSettingsIssue = Schema.Union([
  Schema.Struct({ code: Schema.Literal("file.invalid") }),
  Schema.Struct({ code: Schema.Literal("schema.invalid") }),
  Schema.Struct({ code: Schema.Literal("schema.newer"), version: Schema.Number }),
  Schema.Struct({ code: Schema.Literal("migration.failed"), version: Schema.Number }),
]);
type StructuralSettingsIssue = typeof StructuralSettingsIssue.Type;

export const ReadOnlyReason = Schema.Literals(["newer-version", "unreadable"]);
export type ReadOnlyReason = typeof ReadOnlyReason.Type;

type RawSettings = Readonly<Record<string, unknown>>;
type Mutable<A> = { -readonly [Key in keyof A]: A[Key] };

export type SettingsFields<Editable, Issue> = {
  readonly [Key in keyof Editable]-?: {
    readonly schema: Schema.Codec<Editable[Key], unknown>;
    readonly default: Editable[Key];
    readonly issue: Issue;
    readonly omitWhenDefault?: boolean;
  };
};

type Migrations = Readonly<Record<number, (raw: RawSettings) => unknown>>;

type SettingsCodecOptions<Editable, Issue> = {
  readonly version: number;
  readonly fields: SettingsFields<Editable, Issue>;
  readonly migrations: Migrations;
};

type DecodeResult<Editable, Issue> = {
  readonly settings: Editable;
  readonly issues: readonly (Issue | StructuralSettingsIssue)[];
  readonly readOnlyReason?: ReadOnlyReason;
};

function isRecord(value: unknown): value is RawSettings {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const prototype: unknown = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function versionOf(
  raw: RawSettings,
  current: number,
): {
  readonly version: number;
  readonly issues: readonly StructuralSettingsIssue[];
} {
  if (!Object.hasOwn(raw, "schemaVersion")) return { version: current, issues: [] };

  const version = raw.schemaVersion;
  if (typeof version === "number" && Number.isInteger(version) && version > 0) {
    return { version, issues: [] };
  }
  return { version: current, issues: [{ code: "schema.invalid" }] };
}

type MigrationResult =
  | { readonly ok: true; readonly raw: RawSettings }
  | { readonly ok: false; readonly version: number };

function runMigrations(
  raw: RawSettings,
  start: number,
  target: number,
  migrations: Migrations,
): MigrationResult {
  let value = raw;
  for (let version = start; version < target; version += 1) {
    try {
      const next = migrations[version]?.({ ...value });
      if (!isRecord(next)) return { ok: false, version };
      value = { ...next, schemaVersion: version + 1 };
    } catch {
      return { ok: false, version };
    }
  }
  return { ok: true, raw: value };
}

export function makeSettingsCodec<Editable extends object, Issue>({
  version,
  fields,
  migrations,
}: SettingsCodecOptions<Editable, Issue>) {
  const keys = Object.keys(fields) as (keyof Editable & string)[];
  const defaults = Object.freeze(
    Object.fromEntries(keys.map((key) => [key, fields[key].default])),
  ) as Editable;

  function decodeFields(raw: RawSettings) {
    const patch: Partial<Mutable<Editable>> = {};
    const issues: Issue[] = [];

    for (const key of keys) {
      if (!Object.hasOwn(raw, key)) continue;
      const field = fields[key];
      try {
        patch[key] = Schema.decodeUnknownSync(field.schema)(raw[key]);
      } catch {
        issues.push(field.issue);
      }
    }
    return { patch, issues };
  }

  function decode(input: unknown): DecodeResult<Editable, Issue> {
    if (input === undefined || input === null) return { settings: defaults, issues: [] };
    try {
      if (!isRecord(input)) return { settings: defaults, issues: [{ code: "file.invalid" }] };

      const file = versionOf(input, version);
      if (file.version > version) {
        return {
          settings: defaults,
          issues: [{ code: "schema.newer", version: file.version }],
          readOnlyReason: "newer-version",
        };
      }

      const migrated = runMigrations(input, file.version, version, migrations);
      if (!migrated.ok) {
        return {
          settings: defaults,
          issues: [{ code: "migration.failed", version: migrated.version }],
          readOnlyReason: "unreadable",
        };
      }

      const { patch, issues } = decodeFields(migrated.raw);
      return { settings: { ...defaults, ...patch }, issues: [...file.issues, ...issues] };
    } catch {
      return { settings: defaults, issues: [{ code: "file.invalid" }] };
    }
  }

  function encode(settings: Editable): RawSettings {
    const raw: Record<string, unknown> = { schemaVersion: version };
    for (const key of keys) {
      const field = fields[key];
      const value = settings[key];
      if (field.omitWhenDefault && Object.is(value, field.default)) continue;
      raw[key] = Schema.encodeSync(field.schema)(value);
    }
    return raw;
  }

  function validatePatch(input: unknown): {
    readonly patch: Partial<Editable>;
    readonly issues: readonly (Issue | StructuralSettingsIssue)[];
  } {
    return isRecord(input)
      ? decodeFields(input)
      : { patch: {}, issues: [{ code: "file.invalid" }] };
  }

  return { defaults, decode, encode, validatePatch };
}
