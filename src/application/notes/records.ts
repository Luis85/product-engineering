import { Effect, Result } from "effect";
import { recordId, schemaMarker } from "../../domain/notes";
import type { Frontmatter, NoteType } from "../../domain/notes";
import { NoteEditConflictError, NoteWriteRefusedError } from "./errors";
import { IdGenerator } from "./ports";
import type { FrontmatterChange } from "./ports";

export function recordFrontmatter(type: NoteType, id: string, values: Frontmatter): Frontmatter {
  const fields = type.keys.flatMap((key) => {
    const value = Object.hasOwn(values, key) ? values[key] : undefined;
    return value === undefined || value === null ? [] : [[key, value] as const];
  });
  return {
    schema: schemaMarker(type.type, type.version),
    id,
    ...Object.fromEntries(fields),
  };
}

export function newRecordFrontmatter(
  type: NoteType,
  values: Frontmatter,
): Effect.Effect<Frontmatter, never, IdGenerator> {
  return Effect.gen(function* () {
    const generator = yield* IdGenerator;
    const uuid = yield* generator.nextId;
    return recordFrontmatter(type, recordId(type.type, uuid), values);
  });
}

export function editChange(
  type: NoteType,
  base: Frontmatter,
  edited: Frontmatter,
): FrontmatterChange<NoteWriteRefusedError | NoteEditConflictError> {
  return (current) =>
    Result.mapError(type.merge(base, edited, current), (failure) =>
      failure.kind === "refused"
        ? new NoteWriteRefusedError({ reason: failure.reason })
        : new NoteEditConflictError({ conflicts: failure.conflicts }),
    );
}
