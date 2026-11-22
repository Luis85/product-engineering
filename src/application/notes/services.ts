import type { IdGenerator, NoteOpener, NoteStore } from "./ports";

export type NotesServices = NoteStore | NoteOpener | IdGenerator | NoteIndex;
import type { NoteIndex } from "./note-index";
