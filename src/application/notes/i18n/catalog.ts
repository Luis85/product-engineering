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
  readonly unindexed: {
    readonly label: string;
    readonly loading: string;
    readonly empty: string;
    readonly count: (value: number) => string;
    readonly malformedSchema: string;
    readonly unknownType: (type: string) => string;
    readonly unreadableFrontmatter: string;
  };
  readonly notices: {
    readonly created: (title: string) => string;
    readonly saved: (title: string) => string;
    readonly deleted: (title: string) => string;
  };
  readonly conflict: {
    readonly title: string;
    readonly detail: string;
    readonly base: string;
    readonly mine: string;
    readonly current: string;
    readonly apply: string;
    readonly empty: string;
    readonly unavailable: string;
    readonly trueValue: string;
    readonly falseValue: string;
  };
  readonly deleteDialog: {
    readonly title: (name: string) => string;
    readonly detail: string;
    readonly cancel: string;
    readonly confirm: string;
  };
  readonly openNote: string;
  readonly invalidName: {
    readonly title: string;
    readonly details: Readonly<Record<NoteNameIssue, string>>;
  };
  readonly writeRefused: {
    readonly title: string;
    readonly details: Readonly<Record<WriteRefusal, string>>;
  };
};
