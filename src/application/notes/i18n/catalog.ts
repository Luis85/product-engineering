import type { NoteNameIssue, WriteRefusal } from "../../../domain/notes";
import type { NotesError } from "../errors";

type NamedError = Exclude<NotesError["_tag"], "InvalidNoteNameError" | "NoteWriteRefusedError">;
type Message = { readonly title: string; readonly detail: string };

export type NotesCatalog = {
  readonly errors: Readonly<Record<NamedError, Message>>;
  readonly invalidName: {
    readonly title: string;
    readonly details: Readonly<Record<NoteNameIssue, string>>;
  };
  readonly writeRefused: {
    readonly title: string;
    readonly details: Readonly<Record<WriteRefusal, string>>;
  };
};
