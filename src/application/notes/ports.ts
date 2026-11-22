import { Context } from "effect";
import type { Effect } from "effect";
import type { Frontmatter } from "../../domain/notes";
import type { VaultReadError } from "../shell";
import type {
  InvalidNoteNameError,
  NoteNotFoundError,
  NotePathTakenError,
  NoteTrashError,
  NoteWriteError,
} from "./errors";

export type Note = {
  readonly path: string;
  readonly frontmatter: Frontmatter;
};

export type CreateNoteInput = {
  readonly folder: string;
  readonly name: string;
  readonly frontmatter: Frontmatter;
  readonly body?: string;
};

type CreateNoteError = InvalidNoteNameError | NotePathTakenError | NoteWriteError;

export class NoteStore extends Context.Service<
  NoteStore,
  {
    readonly list: Effect.Effect<readonly Note[], VaultReadError>;
    readonly read: (path: string) => Effect.Effect<Note, VaultReadError | NoteNotFoundError>;
    readonly unreadable: (folder: string) => Effect.Effect<readonly string[], VaultReadError>;
    readonly create: (input: CreateNoteInput) => Effect.Effect<Note, CreateNoteError>;
    readonly rename: (
      path: string,
      newName: string,
    ) => Effect.Effect<Note, CreateNoteError | NoteNotFoundError>;
    readonly trash: (path: string) => Effect.Effect<void, NoteNotFoundError | NoteTrashError>;
  }
>()("product-engineering/application/NoteStore") {}

export class NoteOpener extends Context.Service<
  NoteOpener,
  { readonly open: (path: string) => Effect.Effect<void, NoteNotFoundError | VaultReadError> }
>()("product-engineering/application/NoteOpener") {}

export class IdGenerator extends Context.Service<
  IdGenerator,
  { readonly nextId: Effect.Effect<string> }
>()("product-engineering/application/IdGenerator") {}
