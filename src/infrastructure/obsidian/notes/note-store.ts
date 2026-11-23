import { Effect, Layer, Result } from "effect";
import { normalizePath, parseYaml, TFolder } from "obsidian";
import type { App, CachedMetadata, TFile, Vault } from "obsidian";
import {
  NoteNotFoundError,
  NotePathTakenError,
  NoteStore,
  NoteTrashError,
  NoteWriteError,
} from "../../../application/notes";
import type { CreateNoteInput, NoteContentChange, Note } from "../../../application/notes";
import {
  asDefect,
  copyFrontmatter,
  createNote,
  patchContent,
  pathsInFolder,
  planRename,
  readNoteFrontmatter,
  recordNotes,
  resolveFolderPath,
  trashCommand,
  updateNoteContent,
  writeCommand,
} from "../../../application/notes/adapter";
import { VaultReadError } from "../../../application/shell";
import { clashKey, splitNoteText } from "../../../domain/notes";

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

function findFolder(vault: Vault, requested: string): string {
  return resolveFolderPath(
    requested,
    (path) =>
      folderAt(vault, path)
        ?.children.filter((entry) => entry instanceof TFolder)
        .map(({ name }) => name) ?? [],
  );
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
    const requested = yield* asDefect(() => normalizePath(request.folder));
    const { folder, siblings } = yield* Effect.try({
      try: () => {
        const resolved = findFolder(vault, requested);
        return {
          folder: resolved,
          siblings: folderAt(vault, resolved)?.children.map(({ name }) => name) ?? [],
        };
      },
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

function processNote<E>(vault: Vault, file: TFile, change: NoteContentChange<E>) {
  return Effect.gen(function* () {
    const edit: {
      result?: ReturnType<typeof updateNoteContent<E>>;
      defect?: { cause: unknown };
    } = {};
    const processed = yield* Effect.result(
      Effect.tryPromise({
        try: () =>
          vault.process(file, (text) => {
            try {
              const result = updateNoteContent(text, change, parseYaml);
              edit.result = result;
              return Result.isSuccess(result) ? result.success.text : text;
            } catch (cause) {
              edit.defect = { cause };
              throw cause;
            }
          }),
        catch: () => new NoteWriteError(),
      }),
    );
    if (edit.defect) return yield* Effect.die(edit.defect.cause);
    if (Result.isFailure(processed)) {
      return yield* noteFile(vault, file.path) !== file
        ? new NoteNotFoundError()
        : processed.failure;
    }
    if (!edit.result) return yield* Effect.die(new Error("Vault.process skipped the note editor"));

    const saved = yield* Effect.fromResult(edit.result);
    return { path: normalizePath(file.path), ...saved };
  });
}

function update<E>(vault: Vault, path: string, change: NoteContentChange<E>) {
  return Effect.gen(function* () {
    const file = yield* Effect.try({
      try: () => noteFile(vault, path),
      catch: () => new NoteWriteError(),
    });
    if (!file) return yield* new NoteNotFoundError();
    return yield* writeCommand(processNote(vault, file, change));
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
  const readContent = (path: string) =>
    Effect.gen(function* () {
      const file = yield* readVault(() => noteFile(vault, path));
      if (!file) return yield* new NoteNotFoundError();
      const text = yield* Effect.tryPromise({
        try: () => vault.read(file),
        catch: () => new VaultReadError(),
      });
      const frontmatter = yield* Effect.fromResult(readNoteFrontmatter(text, parseYaml));
      return { path: normalizePath(file.path), frontmatter, body: splitNoteText(text).body, text };
    });
  const sources = readVault(() => vault.getMarkdownFiles().map((file) => cachedNote(app, file)));
  return Layer.succeed(NoteStore, {
    list: Effect.map(sources, recordNotes),
    sources,
    read: (path) =>
      Effect.gen(function* () {
        const file = yield* readVault(() => noteFile(vault, path));
        if (!file) return yield* new NoteNotFoundError();
        return yield* readVault(() => cachedNote(app, file));
      }),
    readFresh: (path) =>
      Effect.map(readContent(path), (note) => ({ path: note.path, frontmatter: note.frontmatter })),
    readContent,
    unreadable: (folder) =>
      readVault(() =>
        pathsInFolder(
          normalizePath(findFolder(vault, normalizePath(folder))),
          vault
            .getMarkdownFiles()
            .filter((file) => unreadable(metadataCache.getFileCache(file)))
            .map((file) => normalizePath(file.path)),
        ),
      ),
    create: (request) => create(app, request),
    update: (path, change) =>
      Effect.map(update(vault, path, patchContent(change)), ({ path: target, frontmatter }) => ({
        path: target,
        frontmatter,
      })),
    updateContent: (path, change) => update(vault, path, change),
    rename: (path, newName) => rename(app, path, newName),
    trash: (path) => trash(app, path),
  });
}
