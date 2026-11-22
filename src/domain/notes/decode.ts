import { Result } from "effect";
import { isPlainRecord, runMigrations } from "../shell";
import type {
  DecodedNote,
  Frontmatter,
  MigrationIssue,
  NoteFields,
  NoteInput,
  NoteType,
  NoteTypeDefinition,
} from "./note-type";
import { recordIdIssue } from "./record-id";
import type { IdIssue } from "./record-id";
import { parseSchemaMarker, schemaMarker } from "./schema-marker";

function migrationFailure(version: number): Result.Result<never, MigrationIssue> {
  return Result.fail({ code: "migration.failed", version });
}

export function migrateNoteFrontmatter(
  definition: NoteTypeDefinition,
  frontmatter: Frontmatter,
  version: number,
): Result.Result<Frontmatter, MigrationIssue> {
  if (version === definition.version) return Result.succeed(frontmatter);
  try {
    const cloned = structuredClone(frontmatter);
    const migrated = runMigrations(
      cloned,
      version,
      definition.version,
      definition.migrations,
      (next, nextVersion) => {
        const properties: Record<string, unknown> = {
          ...next,
          schema: schemaMarker(definition.type, nextVersion),
        };
        if (Object.hasOwn(cloned, "id")) return { ...properties, id: cloned.id };
        delete properties.id;
        return properties;
      },
    );
    return migrated.ok ? Result.succeed(migrated.raw) : migrationFailure(migrated.version);
  } catch {
    return migrationFailure(version);
  }
}

function identity(type: string, frontmatter: Frontmatter): Result.Result<string, IdIssue> {
  const id = Object.hasOwn(frontmatter, "id") ? frontmatter.id : undefined;
  const issue = recordIdIssue(type, id);
  return typeof id === "string" && issue === undefined
    ? Result.succeed(id)
    : Result.fail(issue ?? "id.malformed");
}

function decodeRecord<Fields extends NoteFields, Raw>(
  definition: NoteTypeDefinition<Fields>,
  check: NoteType<Fields>["check"],
  note: NoteInput<Raw> & { readonly version: number },
  raw: Frontmatter,
): DecodedNote<Fields, Raw> {
  const id = identity(definition.type, raw);
  const record = { ...note, ...(Result.isSuccess(id) ? { id: id.success } : {}) };
  if (note.version > definition.version) {
    return {
      ...record,
      kind: "read-only",
      issue: { code: "schema.newer", version: note.version },
      values: {},
    };
  }

  const migrated = migrateNoteFrontmatter(definition, raw, note.version);
  if (Result.isFailure(migrated)) {
    return { ...record, kind: "read-only", issue: migrated.failure, values: {} };
  }

  const { values, issues } = check(migrated.success);
  return Result.isFailure(id)
    ? { ...note, kind: "read-only", issue: { code: id.failure }, values }
    : { ...note, kind: "editable", id: id.success, values, issues };
}

export function decodeNote<Fields extends NoteFields, Raw>(
  definition: NoteTypeDefinition<Fields>,
  check: NoteType<Fields>["check"],
  { path, frontmatter }: NoteInput<Raw>,
): DecodedNote<Fields, Raw> {
  const note = { path, frontmatter };
  try {
    if (!isPlainRecord(frontmatter))
      return { ...note, kind: "not-this-type", marker: { _tag: "none" } };
    const marker = parseSchemaMarker(
      Object.hasOwn(frontmatter, "schema") ? frontmatter.schema : undefined,
    );
    if (marker._tag !== "record" || marker.type !== definition.type) {
      return { ...note, kind: "not-this-type", marker };
    }
    return decodeRecord(definition, check, { ...note, version: marker.version }, frontmatter);
  } catch {
    return { ...note, kind: "not-this-type", marker: { _tag: "malformed" } };
  }
}
