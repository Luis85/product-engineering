import type { UserMessage } from "../../shell";
import type { NotesError } from "../errors";
import type { NotesCatalog } from "./catalog";

export function describeNotesError(error: NotesError, catalog: NotesCatalog): UserMessage {
  if (error._tag === "InvalidNoteNameError") {
    return {
      severity: "warning",
      title: catalog.invalidName.title,
      detail: catalog.invalidName.details[error.issue],
    };
  }

  return { severity: "error", ...catalog.errors[error._tag] };
}
