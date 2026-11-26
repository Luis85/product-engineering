import { Schema } from "effect";
import { isPlainRecord, runMigrations } from "./migrations";
import type { MigrationSteps } from "./migrations";

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

type SettingsCodecOptions<Editable, Issue> = {
  readonly version: number;
  readonly fields: SettingsFields<Editable, Issue>;
  readonly migrations: MigrationSteps;
};

type DecodeResult<Editable, Issue> = {
  readonly settings: Editable;
  readonly issues: readonly (Issue | StructuralSettingsIssue)[];
  readonly readOnlyReason?: ReadOnlyReason;
};

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

function hasAbsentDefault(field: {
  readonly default: unknown;
  readonly omitWhenDefault?: boolean;
}) {
  return field.default === undefined && field.omitWhenDefault === true;
}

export function makeSettingsCodec<Editable extends object, Issue>({
  version,
  fields,
  migrations,
}: SettingsCodecOptions<Editable, Issue>) {
  const keys = Object.keys(fields) as (keyof Editable & string)[];
  const defaults = Object.freeze(
    Object.fromEntries(
      keys.filter((key) => !hasAbsentDefault(fields[key])).map((key) => [key, fields[key].default]),
    ),
  ) as Editable;

  function decodeFields(raw: RawSettings, source: "stored" | "patch") {
    const patch: Partial<Mutable<Editable>> = {};
    const issues: Issue[] = [];

    for (const key of keys) {
      if (!Object.hasOwn(raw, key)) continue;
      const field = fields[key];
      try {
        const value = Schema.decodeUnknownSync(field.schema)(raw[key]);
        if (source === "stored" && value === undefined && hasAbsentDefault(field)) continue;
        patch[key] = value;
      } catch {
        issues.push(field.issue);
      }
    }
    return { patch, issues };
  }

  function decode(input: unknown): DecodeResult<Editable, Issue> {
    if (input === undefined || input === null) return { settings: defaults, issues: [] };
    try {
      if (!isPlainRecord(input)) return { settings: defaults, issues: [{ code: "file.invalid" }] };

      const file = versionOf(input, version);
      if (file.version > version) {
        return {
          settings: defaults,
          issues: [{ code: "schema.newer", version: file.version }],
          readOnlyReason: "newer-version",
        };
      }

      const migrated = runMigrations(
        input,
        file.version,
        version,
        migrations,
        (raw, nextVersion) => ({
          ...raw,
          schemaVersion: nextVersion,
        }),
      );
      if (!migrated.ok) {
        return {
          settings: defaults,
          issues: [{ code: "migration.failed", version: migrated.version }],
          readOnlyReason: "unreadable",
        };
      }

      const { patch, issues } = decodeFields(migrated.raw, "stored");
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
    return isPlainRecord(input)
      ? decodeFields(input, "patch")
      : { patch: {}, issues: [{ code: "file.invalid" }] };
  }

  return { defaults, decode, encode, validatePatch };
}
