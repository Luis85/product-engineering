import { Schema } from "effect";
import { NOTE_NAME_ISSUES, WriteRefusal } from "../../domain/notes";
import type { NoteFieldConflict } from "../../domain/notes";
import type { ErrorTags } from "../module";

export class NoteNotFoundError extends Schema.TaggedError<NoteNotFoundError>()(
  "NoteNotFoundError",
  {},
) {}
export class NotePathTakenError extends Schema.TaggedError<NotePathTakenError>()(
  "NotePathTakenError",
  {},
) {}
export class InvalidNoteNameError extends Schema.TaggedError<InvalidNoteNameError>()(
  "InvalidNoteNameError",
  {
    issue: Schema.Literals(NOTE_NAME_ISSUES),
  },
) {}
export class NoteUnreadableError extends Schema.TaggedError<NoteUnreadableError>()(
  "NoteUnreadableError",
  {},
) {}
export class NoteWriteError extends Schema.TaggedError<NoteWriteError>()("NoteWriteError", {}) {}
export class NoteTrashError extends Schema.TaggedError<NoteTrashError>()("NoteTrashError", {}) {}
export class NoteWriteRefusedError extends Schema.TaggedError<NoteWriteRefusedError>()(
  "NoteWriteRefusedError",
  { reason: WriteRefusal },
) {}
const conflicts = Schema.Array(
  Schema.Struct({
    key: Schema.String,
    base: Schema.Unknown,
    edited: Schema.Unknown,
    current: Schema.Unknown,
  }),
) satisfies Schema.Codec<readonly NoteFieldConflict[], unknown>;

export class NoteEditConflictError extends Schema.TaggedError<NoteEditConflictError>()(
  "NoteEditConflictError",
  { conflicts },
) {}
export class NoteIndexReadError extends Schema.TaggedError<NoteIndexReadError>()(
  "NoteIndexReadError",
  {},
) {}

export type NotesError =
  | NoteNotFoundError
  | NotePathTakenError
  | InvalidNoteNameError
  | NoteUnreadableError
  | NoteWriteError
  | NoteWriteRefusedError
  | NoteEditConflictError
  | NoteIndexReadError
  | NoteTrashError;

export const NOTES_ERROR_TAG_KEYS = {
  NoteNotFoundError: true,
  NotePathTakenError: true,
  InvalidNoteNameError: true,
  NoteUnreadableError: true,
  NoteWriteError: true,
  NoteWriteRefusedError: true,
  NoteEditConflictError: true,
  NoteIndexReadError: true,
  NoteTrashError: true,
} satisfies ErrorTags<NotesError>;
