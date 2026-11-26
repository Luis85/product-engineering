import { Result } from "effect";
import { isPlainRecord } from "../shell";
import { decodeNote } from "./decode";
import type { Field } from "./fields";
import type {
  FieldIssue,
  NoteCheck,
  NoteFieldCode,
  NoteFields,
  NoteKey,
  NoteType,
  NoteTypeDefinition,
} from "./note-type";
import { parseSchemaMarker, schemaMarker } from "./schema-marker";
import { mergeNoteWrite } from "./write";

const snakeCase = /^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/;

type FieldEntry<Fields extends NoteFields> = readonly [NoteKey<Fields>, Field<unknown, string>];

function checkFields<Fields extends NoteFields>(
  fields: readonly FieldEntry<Fields>[],
  input: unknown,
): NoteCheck<Fields> {
  const raw = isPlainRecord(input) ? input : {};
  const entries: [NoteKey<Fields>, unknown][] = [];
  const issues: FieldIssue<NoteKey<Fields>, NoteFieldCode<Fields>>[] = [];

  for (const [key, field] of fields) {
    const result = field.check(Object.hasOwn(raw, key) ? raw[key] : undefined);
    if (Result.isFailure(result))
      issues.push({ key, code: result.failure as NoteFieldCode<Fields> });
    else if (result.success !== undefined) entries.push([key, result.success]);
  }
  return { values: Object.fromEntries(entries) as NoteCheck<Fields>["values"], issues };
}

export function defineNoteType<const Fields extends NoteFields, const Type extends string>(
  definition: NoteTypeDefinition<Fields, Type>,
): NoteType<Fields, Type> {
  if (parseSchemaMarker(schemaMarker(definition.type, definition.version))._tag !== "record") {
    throw new TypeError("Invalid note type or version");
  }
  const fields = Object.entries(definition.fields).map(([key, field]): FieldEntry<Fields> => [
    key as NoteKey<Fields>,
    field,
  ]);
  const keys = Object.freeze(fields.map(([key]) => key));
  for (const key of keys) {
    if (!snakeCase.test(key) || key === "schema" || key === "id") {
      throw new TypeError("Invalid note field key: " + key);
    }
  }

  const check = (values: unknown) => checkFields<Fields>(fields, values);
  return {
    ...definition,
    keys,
    check,
    decode: (note) => decodeNote(definition, check, note),
    merge: (base, edited, current) => mergeNoteWrite(definition, base, edited, current),
  };
}
