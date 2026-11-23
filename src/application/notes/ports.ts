import { Context } from "effect";
import type { Effect, Result } from "effect";
import type { Frontmatter, FrontmatterPatch } from "../../domain/notes";
import type { VaultReadError } from "../shell";
import type {
  InvalidNoteNameError,
  NoteNotFoundError,
  NotePathTakenError,
  NoteTrashError,
  NoteUnreadableError,
  NoteWriteError,
  NoteWriteRefusedError,
} from "./errors";

export type Note = {
  readonly path: string;
  readonly frontmatter: Frontmatter;
};

type NoteContent = Note & { readonly body: string };

export type CreateNoteInput = {
  readonly folder: string;
  readonly name: string;
  readonly frontmatter: Frontmatter;
  readonly body?: string;
};

type CreateNoteError = InvalidNoteNameError | NotePathTakenError | NoteWriteError;
type UpdateNoteError =
  NoteNotFoundError | NoteUnreadableError | NoteWriteError | NoteWriteRefusedError;

export type FrontmatterChange<E = never> = (
  current: Frontmatter,
) => Result.Result<FrontmatterPatch, E>;

export class NoteStore extends Context.Service<
  NoteStore,
  {
    readonly list: Effect.Effect<readonly Note[], VaultReadError>;
    readonly read: (path: string) => Effect.Effect<Note, VaultReadError | NoteNotFoundError>;
    readonly readFresh: (
      path: string,
    ) => Effect.Effect<Note, VaultReadError | NoteNotFoundError | NoteUnreadableError>;
    readonly readContent: (
      path: string,
    ) => Effect.Effect<NoteContent, VaultReadError | NoteNotFoundError | NoteUnreadableError>;
    readonly unreadable: (folder: string) => Effect.Effect<readonly string[], VaultReadError>;
    readonly create: (input: CreateNoteInput) => Effect.Effect<Note, CreateNoteError>;
    readonly update: <E>(
      path: string,
      change: FrontmatterChange<E>,
    ) => Effect.Effect<Note, E | UpdateNoteError>;
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
