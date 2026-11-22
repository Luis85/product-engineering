import { Effect, Layer } from "effect";
import { normalizePath } from "obsidian";
import type { App, CachedMetadata, TFile, Vault } from "obsidian";
import {
  NoteNotFoundError,
  NotePathTakenError,
  NoteStore,
  NoteTrashError,
  NoteWriteError,
} from "../../../application/notes";
import type { CreateNoteInput, Note } from "../../../application/notes";
import {
  asDefect,
  copyFrontmatter,
  createNote,
  pathsInFolder,
  planRename,
  recordNotes,
  trashCommand,
  writeCommand,
} from "../../../application/notes/adapter";
import { VaultReadError } from "../../../application/shell";
import { clashKey } from "../../../domain/notes";

export function noteFile(vault: Vault, path: string): TFile | undefined {
  const file = vault.getFileByPath(normalizePath(path));
  return file?.extension.toLowerCase() === "md" ? file : undefined;
}

function readVault<A>(run: () => A): Effect.Effect<A, VaultReadError> {
  return Effect.try({ try: run, catch: () => new VaultReadError() });
}

function cachedNote(app: App, file: TFile): Note {
  return {
    path: normalizePath(file.path),
    frontmatter: copyFrontmatter(app.metadataCache.getFileCache(file)?.frontmatter),
  };
}

function unreadable(cache: CachedMetadata | null): boolean {
  return (
    !cache?.frontmatter &&
    (cache?.sections ?? []).some(
      ({ type, position }) => type === "yaml" && position.end.line - position.start.line > 1,
    )
  );
}

function folderAt(vault: Vault, path: string) {
  return path === "/" ? vault.getRoot() : vault.getFolderByPath(path);
}

function basename(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1);
}

function taken(vault: Vault, path: string, original?: TFile): boolean {
  const parent = normalizePath(path.slice(0, Math.max(0, path.lastIndexOf("/"))));
  const target = clashKey(basename(path));
  return (folderAt(vault, parent)?.children ?? []).some(
    (entry) => entry !== original && clashKey(entry.name) === target,
  );
}

async function ensureFolder(vault: Vault, folder: string): Promise<void> {
  if (folderAt(vault, folder)) return;
  try {
    await vault.createFolder(folder);
  } catch (cause) {
    if (!folderAt(vault, folder)) throw cause;
  }
}

function create(app: App, request: CreateNoteInput) {
  const { vault } = app;
  return Effect.gen(function* () {
    const folder = yield* asDefect(() => normalizePath(request.folder));
    const siblings = yield* Effect.try({
      try: () => folderAt(vault, folder)?.children.map(({ name }) => name) ?? [],
      catch: () => new NoteWriteError(),
    });
    return yield* createNote({ ...request, folder }, siblings, (path, text) => {
      const target = normalizePath(path);
      return Effect.tryPromise({
        try: async () => {
          await ensureFolder(vault, folder);
          return normalizePath((await vault.create(target, text)).path);
        },
        catch: () => (taken(vault, target) ? new NotePathTakenError() : new NoteWriteError()),
      });
    });
  });
}

function rename(app: App, path: string, newName: string) {
  const { vault, fileManager } = app;
  return Effect.gen(function* () {
    const source = yield* Effect.try({
      try: () => {
        const file = noteFile(vault, path);
        return (
          file && {
            file,
            note: cachedNote(app, file),
            siblings: file.parent?.children.map(({ name }) => name) ?? [],
          }
        );
      },
      catch: () => new NoteWriteError(),
    });
    if (!source) return yield* new NoteNotFoundError();

    const { file, note, siblings } = source;
    const planned = yield* planRename(note.path, newName, siblings);
    const target = normalizePath(planned);
    if (target === note.path) return note;

    yield* writeCommand(
      Effect.tryPromise({
        try: () => fileManager.renameFile(file, target),
        catch: () => {
          if (noteFile(vault, file.path) !== file) return new NoteNotFoundError();
          if (taken(vault, target, file)) return new NotePathTakenError();
          return new NoteWriteError();
        },
      }),
    );
    return { ...note, path: normalizePath(file.path) };
  });
}

function trash(app: App, path: string) {
  const { vault, fileManager } = app;
  return Effect.gen(function* () {
    const file = yield* Effect.try({
      try: () => noteFile(vault, path),
      catch: () => new NoteTrashError(),
    });
    if (!file) return yield* new NoteNotFoundError();

    yield* trashCommand(
      Effect.tryPromise({
        // The host can resolve false for a refused system trash move.
        try: (): Promise<unknown> => fileManager.trashFile(file),
        catch: () =>
          noteFile(vault, file.path) !== file ? new NoteNotFoundError() : new NoteTrashError(),
      }).pipe(
        Effect.flatMap((result) =>
          result === false ? Effect.fail(new NoteTrashError()) : Effect.void,
        ),
      ),
    );
  });
}

export function noteStoreLayer(app: App) {
  const { vault, metadataCache } = app;
  return Layer.succeed(NoteStore, {
    list: readVault(() =>
      recordNotes(vault.getMarkdownFiles().map((file) => cachedNote(app, file))),
    ),
    read: (path) =>
      Effect.gen(function* () {
        const file = yield* readVault(() => noteFile(vault, path));
        if (!file) return yield* new NoteNotFoundError();
        return yield* readVault(() => cachedNote(app, file));
      }),
    unreadable: (folder) =>
      readVault(() =>
        pathsInFolder(
          normalizePath(folder),
          vault
            .getMarkdownFiles()
            .filter((file) => unreadable(metadataCache.getFileCache(file)))
            .map((file) => normalizePath(file.path)),
        ),
      ),
    create: (request) => create(app, request),
    rename: (path, newName) => rename(app, path, newName),
    trash: (path) => trash(app, path),
  });
}
