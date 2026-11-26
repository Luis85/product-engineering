import { Result, Schema } from "effect";
import { migrateNoteFrontmatter } from "./decode";
import type { Field } from "./fields";
import { sameFrontmatterValue } from "./frontmatter-equality";
import type { Frontmatter, FrontmatterPatch, NoteFields, NoteTypeDefinition } from "./note-type";
import { recordIdIssue } from "./record-id";
import { parseSchemaMarker } from "./schema-marker";

export const WriteRefusal = Schema.Literals([
  "other-type",
  "newer-version",
  "identity",
  "duplicate-id",
  "migration-failed",
  "layout",
]);

export type WriteRefusal = typeof WriteRefusal.Type;

export interface NoteFieldConflict {
  readonly key: string;
  readonly base: unknown;
  readonly edited: unknown;
  readonly current: unknown;
}

type Refusal = { readonly kind: "refused"; readonly reason: WriteRefusal };

export type NoteMergeFailure =
  Refusal | { readonly kind: "conflict"; readonly conflicts: readonly NoteFieldConflict[] };

function refusal(reason: WriteRefusal): Refusal {
  return { kind: "refused", reason };
}

function property(frontmatter: Frontmatter, key: string): unknown {
  return Object.hasOwn(frontmatter, key) ? (frontmatter[key] ?? undefined) : undefined;
}

function recordVersion(type: NoteTypeDefinition, frontmatter: Frontmatter) {
  const marker = parseSchemaMarker(property(frontmatter, "schema"));
  if (marker._tag !== "record" || marker.type !== type.type)
    return Result.fail(refusal("other-type"));
  if (marker.version > type.version) return Result.fail(refusal("newer-version"));
  return Result.succeed(marker.version);
}

function migrated(type: NoteTypeDefinition, raw: Frontmatter, version: number) {
  return Result.mapError(migrateNoteFrontmatter(type, raw, version), () =>
    refusal("migration-failed"),
  );
}

function unchanged(field: Field<unknown, string>, base: unknown, edited: unknown): boolean {
  if (sameFrontmatterValue(base, edited)) return true;
  // The form initializes a broken field with no value. Leave it alone until the user supplies one.
  return edited === undefined && Result.isFailure(field.check(base));
}

function mergeFields(
  fields: NoteFields,
  base: Frontmatter,
  edited: Frontmatter,
  current: Frontmatter,
) {
  const target = new Map(Object.entries(current));
  const conflicts: NoteFieldConflict[] = [];
  for (const [key, field] of Object.entries(fields)) {
    const before = property(base, key);
    const after = property(edited, key);
    const fresh = property(current, key);
    if (unchanged(field, before, after) || sameFrontmatterValue(after, fresh)) continue;
    if (!sameFrontmatterValue(before, fresh)) {
      conflicts.push({ key, base: before, edited: after, current: fresh });
    } else if (after === undefined) {
      target.delete(key);
    } else {
      target.set(key, after);
    }
  }
  return conflicts.length > 0
    ? Result.fail({ kind: "conflict" as const, conflicts })
    : Result.succeed(target);
}

function diff(current: Frontmatter, target: ReadonlyMap<string, unknown>): FrontmatterPatch {
  const set = [...target].filter(
    ([key, value]) => !Object.hasOwn(current, key) || !sameFrontmatterValue(current[key], value),
  );
  const remove = Object.keys(current).filter((key) => !target.has(key));
  return {
    ...(set.length > 0 ? { set: Object.fromEntries(set) } : {}),
    ...(remove.length > 0 ? { remove } : {}),
  };
}

export function mergeNoteWrite(
  type: NoteTypeDefinition,
  base: Frontmatter,
  edited: Frontmatter,
  current: Frontmatter,
): Result.Result<FrontmatterPatch, NoteMergeFailure> {
  return Result.gen(function* () {
    const currentVersion = yield* recordVersion(type, current);
    const id = property(current, "id");
    if (recordIdIssue(type.type, id) !== undefined || id !== property(base, "id")) {
      return yield* Result.fail(refusal("identity"));
    }
    const baseVersion = yield* recordVersion(type, base);
    const before = yield* migrated(type, base, baseVersion);
    const fresh = yield* migrated(type, current, currentVersion);
    const target = yield* mergeFields(type.fields, before, edited, fresh);
    return diff(current, target);
  });
}

export function rebaseRecordFrontmatter(
  type: NoteTypeDefinition,
  base: Frontmatter,
  conflicts: readonly NoteFieldConflict[],
): Result.Result<Frontmatter, Refusal> {
  return Result.gen(function* () {
    const version = yield* recordVersion(type, base);
    const baseline = yield* migrated(type, base, version);
    const rebased = new Map(Object.entries(baseline));
    for (const { key, current } of conflicts) {
      if (!Object.hasOwn(type.fields, key)) continue;
      if (current === undefined || current === null) rebased.delete(key);
      else rebased.set(key, current);
    }
    return Object.fromEntries(rebased);
  });
}
