import type { CoreFieldIssue, IdIssue, NoteNameIssue, WriteRefusal } from "../../../domain/notes";
import type { NotesError } from "../errors";

type NamedError = Exclude<NotesError["_tag"], "InvalidNoteNameError" | "NoteWriteRefusedError">;
type Message = { readonly title: string; readonly detail: string };
type FieldDescription = (label: string) => string;

type NoteIssueDescriptions = {
  readonly fields: Readonly<Record<CoreFieldIssue, FieldDescription>>;
  readonly customField: FieldDescription;
  readonly identity: Readonly<Record<IdIssue, string>>;
  readonly duplicateId: (other: string) => string;
  readonly newerSchema: (version: number) => string;
  readonly failedMigration: (version: number) => string;
};

export type NotesCatalog = {
  readonly errors: Readonly<Record<NamedError, Message>>;
  readonly issues: NoteIssueDescriptions;
  readonly invalidName: {
    readonly title: string;
    readonly details: Readonly<Record<NoteNameIssue, string>>;
  };
  readonly writeRefused: {
    readonly title: string;
    readonly details: Readonly<Record<WriteRefusal, string>>;
  };
};
