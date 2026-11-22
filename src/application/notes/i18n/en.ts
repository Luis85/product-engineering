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
  writeRefused: {
    title: "Could not edit the note safely",
    details: {
      "other-type": "Select a note for this record type.",
      "newer-version": "Update the Product Engineering plugin before editing this note.",
      identity: "Open the note and check its record ID and schema.",
      "duplicate-id": "Give each record a unique ID before editing.",
      "migration-failed": "Open the note and fix its properties before editing.",
      layout: "Open the note and write each frontmatter property on its own line.",
    },
  },
};
