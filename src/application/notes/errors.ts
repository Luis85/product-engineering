import { Schema } from "effect";
import { NOTE_NAME_ISSUES } from "../../domain/notes";
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

export type NotesError =
  | NoteNotFoundError
  | NotePathTakenError
  | InvalidNoteNameError
  | NoteUnreadableError
  | NoteWriteError
  | NoteTrashError;

export const NOTES_ERROR_TAG_KEYS = {
  NoteNotFoundError: true,
  NotePathTakenError: true,
  InvalidNoteNameError: true,
  NoteUnreadableError: true,
  NoteWriteError: true,
  NoteTrashError: true,
} satisfies ErrorTags<NotesError>;
