import type { CoreFieldIssue, NoteIssue } from "../../../domain/notes";
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
  if (error._tag === "NoteWriteRefusedError") {
    return {
      severity: "warning",
      title: catalog.writeRefused.title,
      detail: catalog.writeRefused.details[error.reason],
    };
  }

  return {
    severity: error._tag === "NoteEditConflictError" ? "warning" : "error",
    ...catalog.errors[error._tag],
  };
}

export function describeNoteIssue(
  issue: NoteIssue,
  catalog: NotesCatalog,
  label: (key: string) => string,
): string {
  const messages = catalog.issues;
  if ("key" in issue) {
    const describe = Object.hasOwn(messages.fields, issue.code)
      ? messages.fields[issue.code as CoreFieldIssue]
      : messages.customField;
    return describe(label(issue.key));
  }
  if ("other" in issue) return messages.duplicateId(issue.other);
  if (issue.code === "schema.newer") return messages.newerSchema(issue.version);
  if (issue.code === "migration.failed") return messages.failedMigration(issue.version);
  return messages.identity[issue.code];
}
