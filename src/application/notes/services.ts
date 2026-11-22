import type { IdGenerator, NoteOpener, NoteStore } from "./ports";

export type NotesServices = NoteStore | NoteOpener | IdGenerator;
