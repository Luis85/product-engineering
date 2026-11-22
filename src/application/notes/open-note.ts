import { NoteOpener } from "./ports";

export function openNote(path: string) {
  return NoteOpener.use((opener) => opener.open(path));
}
