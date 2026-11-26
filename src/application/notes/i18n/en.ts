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
    NoteEditConflictError: {
      title: "Changes conflict",
      detail: "Review the fields that changed in the vault while you were editing.",
    },
    NoteIndexReadError: {
      title: "Could not read records",
      detail: "Rebuild the note index to try again.",
    },
  },
  issues: {
    fields: {
      "field.text": (label) => `${label} must be text.`,
      "field.number": (label) => `Enter a finite number for ${label}.`,
      "field.checkbox": (label) => `Choose true or false for ${label}.`,
      "field.date": (label) => `Enter a valid date for ${label} in YYYY-MM-DD format.`,
      "field.list": (label) => `${label} must be a list of text values.`,
      "field.missing": (label) => `Enter a value for ${label}.`,
    },
    customField: (label) => `Check the value of ${label}.`,
    identity: {
      "id.missing": "The record ID is missing.",
      "id.malformed": "The record ID format is invalid.",
      "id.other-type": "The record ID belongs to another record type.",
    },
    duplicateId: (other) => `Another note uses this record ID (${other}).`,
    newerSchema: (version) => `This note uses a newer record schema (version ${version}).`,
    failedMigration: (version) => `The record could not be migrated from version ${version}.`,
  },
  unindexed: {
    label: "Data issues",
    loading: "Checking notes…",
    empty: "No data issues found.",
    count: (value) => (value === 1 ? "1 data issue" : `${value} data issues`),
    malformedSchema: "The record schema has an invalid format.",
    unknownType: (type) => `The record type ${type} is not registered.`,
    unreadableFrontmatter: "Open the note and correct its frontmatter.",
  },
  notices: {
    created: (title) => `Created ${title}`,
    saved: (title) => `Saved ${title}`,
    deleted: (title) => `Deleted ${title}`,
  },
  conflict: {
    title: "Review conflicting changes",
    detail: "Choose the value to keep for each field, then save again.",
    base: "When you opened the form",
    mine: "Your change",
    current: "Current note",
    apply: "Apply choices",
    empty: "Empty",
    unavailable: "Cannot display this value",
    trueValue: "Yes",
    falseValue: "No",
  },
  deleteDialog: {
    title: (name) => `Delete ${name}?`,
    detail: "The note will be moved to the trash according to your Obsidian settings.",
    cancel: "Cancel",
    confirm: "Delete note",
  },
  openNote: "Open in Obsidian",
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
