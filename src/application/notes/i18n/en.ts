import type { NotesCatalog } from "./catalog";

export const en: NotesCatalog = {
  errors: {
    NoteNotFoundError: { title: "Note unavailable", detail: "Choose an existing Markdown note." },
    NotePathTakenError: { title: "Name already in use", detail: "Choose a different note name." },
    NoteUnreadableError: {
      title: "Frontmatter is unreadable",
      detail: "Open the note and correct its frontmatter.",
    },
    NoteWriteError: { title: "Could not save the note", detail: "Try saving the note again." },
    NoteTrashError: { title: "Could not delete the note", detail: "Try deleting the note again." },
  },
  invalidName: {
    title: "Invalid note name",
    details: {
      empty: "Enter a name for the note.",
      "forbidden-character": "Remove the unsupported characters from the note name.",
      "leading-dot": "Start the note name with a character other than a dot.",
    },
  },
};
