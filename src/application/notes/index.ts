export {
  InvalidNoteNameError,
  NoteEditConflictError,
  NoteIndexReadError,
  NoteNotFoundError,
  NotePathTakenError,
  NoteTrashError,
  NoteUnreadableError,
  NoteWriteError,
  NoteWriteRefusedError,
} from "./errors";
export { isInFolder, recordFolder } from "./folders";
export { describeRecordIssue } from "./i18n/record-texts";
export type { IssueSentences, RecordTexts } from "./i18n/record-texts";
export { noteIndexLayer } from "./index-live";
export {
  noteChanges,
  noteSnapshot,
  rebuildNoteIndex,
  unindexedChanges,
  unindexedSnapshot,
} from "./index-use-cases";
export { notesModule } from "./module";
export { NoteIndex } from "./note-index";
export { openNote } from "./open-note";
export { IdGenerator, NoteOpener, NoteStore } from "./ports";
export type { CreateNoteInput, FrontmatterChange, Note } from "./ports";
export { defineRecords } from "./record-kit";
export type { RecordList, RecordRow } from "./record-list";
export { editChange, newRecordFrontmatter } from "./records";
export { DATA_ISSUES_SECTION } from "./routes";
export type { NotesServices } from "./services";
export { describeNoteIssue, describeUnindexedIssue } from "./user-messages";
