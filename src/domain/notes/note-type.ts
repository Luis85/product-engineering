import type { Result } from "effect";
import type { MigrationSteps } from "../shell";
import type { Field } from "./fields";
import type { IdIssue } from "./record-id";
import type { SchemaMarker } from "./schema-marker";
import type { NoteMergeFailure } from "./write";

export type Frontmatter = Readonly<Record<string, unknown>>;

export interface FrontmatterPatch {
  readonly set?: Frontmatter;
  readonly remove?: readonly string[];
}

export type NoteFields = Readonly<Record<string, Field<unknown, string>>>;
export type NoteKey<Fields extends NoteFields> = Extract<keyof Fields, string>;
export type NoteFieldCode<Fields extends NoteFields> =
  Fields[NoteKey<Fields>] extends Field<unknown, infer Code> ? Code : never;

export type NoteValues<Fields extends NoteFields> = {
  readonly [Key in NoteKey<Fields>]?: Fields[Key] extends Field<infer Value, string>
    ? Exclude<Value, undefined>
    : never;
};

export interface FieldIssue<Key extends string = string, Code extends string = string> {
  readonly key: Key;
  readonly code: Code;
}

export interface MigrationIssue {
  readonly code: "migration.failed";
  readonly version: number;
}

export type ReadOnlyIssue =
  | MigrationIssue
  | { readonly code: "schema.newer"; readonly version: number }
  | { readonly code: IdIssue }
  | { readonly code: "id.duplicate"; readonly other: string };

export type NoteIssue<Key extends string = string, Code extends string = string> =
  FieldIssue<Key, Code> | ReadOnlyIssue;

export interface NoteInput<Raw = Frontmatter> {
  readonly path: string;
  readonly frontmatter: Raw;
}

interface NoteRecord<Fields extends NoteFields, Raw> extends NoteInput<Raw> {
  readonly version: number;
  readonly values: NoteValues<Fields>;
}

export interface ReadOnlyNote<
  Fields extends NoteFields = NoteFields,
  Raw = Frontmatter,
> extends NoteRecord<Fields, Raw> {
  readonly kind: "read-only";
  readonly id?: string;
  readonly issue: ReadOnlyIssue;
}

export interface EditableNote<
  Fields extends NoteFields = NoteFields,
  Raw = Frontmatter,
> extends NoteRecord<Fields, Raw> {
  readonly kind: "editable";
  readonly id: string;
  readonly issues: readonly FieldIssue<NoteKey<Fields>, NoteFieldCode<Fields>>[];
}

export type DecodedNote<Fields extends NoteFields = NoteFields, Raw = Frontmatter> =
  | (NoteInput<Raw> & { readonly kind: "not-this-type"; readonly marker: SchemaMarker })
  | ReadOnlyNote<Fields, Raw>
  | EditableNote<Fields, Raw>;

export interface NoteCheck<Fields extends NoteFields> {
  readonly values: NoteValues<Fields>;
  readonly issues: readonly FieldIssue<NoteKey<Fields>, NoteFieldCode<Fields>>[];
}

export interface NoteTypeDefinition<
  Fields extends NoteFields = NoteFields,
  Type extends string = string,
> {
  readonly type: Type;
  readonly version: number;
  readonly folder?: string;
  readonly fields: Fields;
  readonly migrations: MigrationSteps;
}

export interface NoteType<
  Fields extends NoteFields = NoteFields,
  Type extends string = string,
> extends NoteTypeDefinition<Fields, Type> {
  readonly keys: readonly NoteKey<Fields>[];
  readonly check: (values: unknown) => NoteCheck<Fields>;
  readonly decode: <Raw>(note: NoteInput<Raw>) => DecodedNote<Fields, Raw>;
  readonly merge: (
    base: Frontmatter,
    edited: Frontmatter,
    current: Frontmatter,
  ) => Result.Result<FrontmatterPatch, NoteMergeFailure>;
}
