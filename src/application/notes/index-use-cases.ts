import { Effect, Stream } from "effect";
import type { NoteFields, NoteType } from "../../domain/notes";
import { NoteIndex } from "./note-index";

export const rebuildNoteIndex = NoteIndex.use((index) => index.rebuild);

export function noteSnapshot<Fields extends NoteFields>(type: NoteType<Fields>) {
  return NoteIndex.use((index) => index.noteSnapshot(type));
}

export function noteChanges<Fields extends NoteFields>(type: NoteType<Fields>) {
  return Stream.unwrap(Effect.map(NoteIndex, (index) => index.noteChanges(type)));
}

export const unindexedSnapshot = NoteIndex.use((index) => index.unindexedSnapshot);
export const unindexedChanges = Stream.unwrap(
  Effect.map(NoteIndex, (index) => index.unindexedChanges),
);
