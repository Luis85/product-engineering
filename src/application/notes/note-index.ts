import { Context } from "effect";
import type { Effect, Stream } from "effect";
import type { EditableNote, NoteFields, NoteType, ReadOnlyNote } from "../../domain/notes";
import type { NoteIndexReadError } from "./errors";
import type { Note } from "./ports";

export type IndexedNote<Fields extends NoteFields = NoteFields> =
  EditableNote<Fields> | ReadOnlyNote<Fields>;

export type UnindexedIssue =
  | { readonly code: "schema.malformed" }
  | { readonly code: "schema.unknown-type"; readonly type: string }
  | { readonly code: "frontmatter.unreadable" };

export interface UnindexedNote {
  readonly path: string;
  readonly issue: UnindexedIssue;
}

export interface NoteIndexSnapshot<Row> {
  readonly ready: boolean;
  readonly failure: NoteIndexReadError | undefined;
  readonly notes: readonly Row[];
}

export class NoteIndex extends Context.Service<
  NoteIndex,
  {
    readonly sourceSnapshot: Effect.Effect<NoteIndexSnapshot<Note>>;
    readonly sourceChanges: Stream.Stream<NoteIndexSnapshot<Note>>;
    readonly noteSnapshot: <Fields extends NoteFields>(
      type: NoteType<Fields>,
    ) => Effect.Effect<NoteIndexSnapshot<IndexedNote<Fields>>>;
    readonly noteChanges: <Fields extends NoteFields>(
      type: NoteType<Fields>,
    ) => Stream.Stream<NoteIndexSnapshot<IndexedNote<Fields>>>;
    readonly unindexedSnapshot: Effect.Effect<NoteIndexSnapshot<UnindexedNote>>;
    readonly unindexedChanges: Stream.Stream<NoteIndexSnapshot<UnindexedNote>>;
    readonly rebuild: Effect.Effect<void>;
  }
>()("product-engineering/application/NoteIndex") {}
