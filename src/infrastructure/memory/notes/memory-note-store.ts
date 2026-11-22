import { Effect, Layer, Option } from "effect";
import type { AppEvent } from "../../../application/events";
import {
  NoteNotFoundError,
  NoteOpener,
  NotePathTakenError,
  NoteStore,
  NoteTrashError,
  NoteWriteError,
} from "../../../application/notes";
import type { CreateNoteInput, Note } from "../../../application/notes";
import {
  copyFrontmatter,
  createNote,
  pathsInFolder,
  planRename,
  recordNotes,
  trashCommand,
  writeCommand,
} from "../../../application/notes/adapter";
import { EventBus, VaultReadError } from "../../../application/shell";
import { clashKey } from "../../../domain/notes";
import type { Frontmatter } from "../../../domain/notes";
import { normalizeMemoryPath } from "./normalize-path";

export const TEST_ONLY_MARKER = "product-engineering/test-only";

type Seed = Frontmatter | "none" | "broken";
type File = { path: string; frontmatter: Seed; body: string };

function basename(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1);
}

function folderOf(path: string): string {
  const separator = path.lastIndexOf("/");
  return separator < 1 ? "/" : path.slice(0, separator);
}

function extension(path: string): string {
  const name = basename(path);
  const dot = name.lastIndexOf(".");
  return dot < 1 ? "" : name.slice(dot + 1).toLowerCase();
}

function markdown(file: File): boolean {
  return extension(file.path) === "md";
}

function noteOf(file: File): Note {
  return { path: file.path, frontmatter: structuredClone(copyFrontmatter(file.frontmatter)) };
}

function synthetic<E extends Error>(error: E): E {
  error.message = TEST_ONLY_MARKER;
  return error;
}

function publish(events: readonly AppEvent[]): Effect.Effect<void> {
  return Effect.gen(function* () {
    const bus = yield* Effect.serviceOption(EventBus);
    if (Option.isSome(bus)) {
      yield* Effect.forEach(events, (event) => bus.value.publish(event), { discard: true });
    }
  });
}

function publishedWrite(path: string, tag: "FileCreated" | "FileModified"): Effect.Effect<void> {
  const fields = { path, extension: extension(path) };
  return publish([
    { _tag: tag, ...fields },
    { _tag: "MetadataChanged", ...fields },
  ]);
}

export function memoryNoteStore() {
  const files = new Map<string, File>();
  const folders = new Set(["/"]);
  const opened: string[] = [];
  const waiting: (() => void)[] = [];
  let failReads = false;
  let failWrites = false;
  let held = false;

  function occupied(path: string, own?: string): boolean {
    const key = clashKey(path);
    return [...files.keys(), ...folders].some(
      (current) => current !== own && clashKey(current) === key,
    );
  }

  function siblings(folder: string): string[] {
    return [...files.keys(), ...folders]
      .filter((path) => path !== folder && folderOf(path) === folder)
      .map(basename);
  }

  function makeFolders(folder: string): boolean {
    let path = "";
    for (const name of folder.split("/").filter(Boolean)) {
      path = path ? `${path}/${name}` : name;
      if (folders.has(path)) continue;
      if (occupied(path)) return false;
      folders.add(path);
    }
    return true;
  }

  function fileAt(path: string): File | undefined {
    const file = files.get(normalizeMemoryPath(path));
    return file && markdown(file) ? file : undefined;
  }

  function readable<A>(read: () => A): Effect.Effect<A, VaultReadError> {
    return Effect.suspend(() =>
      failReads ? Effect.fail(new VaultReadError({ cause: TEST_ONLY_MARKER })) : Effect.sync(read),
    );
  }

  const waitForWrite = Effect.suspend(() =>
    held
      ? Effect.promise(
          () =>
            new Promise<void>((resolve) => {
              waiting.push(resolve);
            }),
        )
      : Effect.void,
  );

  const read = (path: string) =>
    Effect.gen(function* () {
      const file = yield* readable(() => fileAt(path));
      if (!file) return yield* Effect.fail(new NoteNotFoundError());
      return noteOf(file);
    });

  function create(input: CreateNoteInput) {
    return Effect.suspend(() => {
      const folder = normalizeMemoryPath(input.folder);
      return createNote({ ...input, folder }, siblings(folder), (path, text, payload) =>
        Effect.gen(function* () {
          const target = normalizeMemoryPath(path);
          yield* waitForWrite;
          if (failWrites) return yield* Effect.fail(synthetic(new NoteWriteError()));
          if (!makeFolders(folder)) return yield* Effect.fail(new NoteWriteError());
          if (occupied(target)) return yield* Effect.fail(new NotePathTakenError());
          files.set(target, {
            path: target,
            frontmatter: structuredClone(payload.frontmatter),
            body: payload.body,
          });
          yield* publishedWrite(target, "FileCreated");
          return target;
        }),
      );
    });
  }

  function rename(path: string, name: string) {
    return Effect.gen(function* () {
      const file = fileAt(path);
      if (!file) return yield* Effect.fail(new NoteNotFoundError());
      const oldPath = file.path;
      const planned = yield* planRename(oldPath, name, siblings(folderOf(oldPath)));
      const next = normalizeMemoryPath(planned);
      if (next === oldPath) return noteOf(file);
      return yield* writeCommand(
        Effect.gen(function* () {
          yield* waitForWrite;
          if (files.get(oldPath) !== file) return yield* Effect.fail(new NoteNotFoundError());
          if (failWrites) return yield* Effect.fail(synthetic(new NoteWriteError()));
          if (occupied(next, oldPath)) return yield* Effect.fail(new NotePathTakenError());
          files.delete(oldPath);
          file.path = next;
          files.set(next, file);
          yield* publish([
            { _tag: "FileRenamed", path: next, oldPath, extension: extension(next) },
          ]);
          return noteOf(file);
        }),
      );
    });
  }

  function remove(file: File): Effect.Effect<void> {
    return Effect.suspend(() => {
      files.delete(file.path);
      return publish([{ _tag: "FileDeleted", path: file.path, extension: extension(file.path) }]);
    });
  }

  function trash(path: string) {
    return Effect.gen(function* () {
      const file = fileAt(path);
      if (!file) return yield* Effect.fail(new NoteNotFoundError());
      const original = file.path;
      yield* trashCommand(
        Effect.gen(function* () {
          yield* waitForWrite;
          if (files.get(original) !== file) return yield* Effect.fail(new NoteNotFoundError());
          if (failWrites) return yield* Effect.fail(synthetic(new NoteTrashError()));
          yield* remove(file);
        }),
      );
    });
  }

  function seed(path: string, frontmatter: Seed, body = ""): Effect.Effect<void> {
    return Effect.suspend(() => {
      if (!makeFolders(folderOf(path)))
        throw synthetic(new Error("Could not seed the test folder"));
      const previous = files.get(path);
      const value = structuredClone(frontmatter);
      if (previous) {
        previous.frontmatter = value;
        previous.body = body;
      } else {
        files.set(path, { path, body, frontmatter: value });
      }
      return publishedWrite(path, previous ? "FileModified" : "FileCreated");
    });
  }

  return {
    layer: Layer.succeed(NoteStore, {
      list: readable(() => recordNotes([...files.values()].filter(markdown).map(noteOf))),
      read,
      unreadable: (folder) =>
        readable(() =>
          pathsInFolder(
            normalizeMemoryPath(folder),
            [...files.values()]
              .filter((file) => markdown(file) && file.frontmatter === "broken")
              .map(({ path }) => path),
          ),
        ),
      create,
      rename,
      trash,
    }),
    opener: Layer.succeed(NoteOpener, {
      open: (path) =>
        Effect.tap(read(path), (note) =>
          Effect.sync(() => {
            opened.push(note.path);
          }),
        ).pipe(Effect.asVoid),
    }),
    seed,
    removeOutside: (path: string) =>
      Effect.suspend(() => {
        const file = files.get(path);
        return file ? remove(file) : Effect.void;
      }),
    settle: Effect.void,
    body: (path: string) => files.get(path)?.body,
    isFolder: (path: string) => folders.has(normalizeMemoryPath(path)),
    setFailReads(value: boolean) {
      failReads = value;
    },
    setFailWrites(value: boolean) {
      failWrites = value;
    },
    holdWrites() {
      held = true;
    },
    releaseWrites() {
      held = false;
      for (const release of waiting.splice(0)) release();
    },
    heldWrites: () => waiting.length,
    opened: () => [...opened] as readonly string[],
  };
}
