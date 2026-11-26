import { Effect, Result } from "effect";
import { clashKey, clashName, MAX_NAME_ATTEMPTS, noteNameIssue } from "../../domain/notes";
import type { Frontmatter } from "../../domain/notes";
import { InvalidNoteNameError, NotePathTakenError } from "./index";
import type { CreateNoteInput, Note, NoteWriteError } from "./index";
import { newNoteText } from "./note-text";

export function asDefect<A>(run: () => A): Effect.Effect<A> {
  return Effect.sync(run);
}

export function writeCommand<A, E, R>(run: Effect.Effect<A, E, R>): Effect.Effect<A, E, R> {
  return Effect.uninterruptible(run);
}

export const trashCommand = writeCommand;

type NotePayload = { readonly frontmatter: Frontmatter; readonly body: string };

export function createNote<R>(
  input: CreateNoteInput,
  siblings: readonly string[],
  write: (
    path: string,
    text: string,
    payload: NotePayload,
  ) => Effect.Effect<string, NoteWriteError | NotePathTakenError, R>,
): Effect.Effect<Note, InvalidNoteNameError | NotePathTakenError | NoteWriteError, R> {
  return Effect.gen(function* () {
    const issue = noteNameIssue(input.name);
    if (issue) return yield* Effect.fail(new InvalidNoteNameError({ issue }));

    const name = input.name.trim().normalize("NFC");
    const folder = input.folder === "/" ? "" : input.folder;
    const occupied = new Set(siblings.map(clashKey));
    const payload = yield* asDefect((): NotePayload => ({
      frontmatter: structuredClone(
        Object.fromEntries(
          Object.entries(input.frontmatter).filter(([, value]) => value !== undefined),
        ),
      ),
      body: input.body ?? "",
    }));
    const text = yield* asDefect(() => newNoteText(payload.frontmatter, payload.body));

    for (let attempt = 1; attempt <= MAX_NAME_ATTEMPTS; attempt += 1) {
      const filename = clashName(name, attempt) + ".md";
      if (occupied.has(clashKey(filename))) continue;
      const path = folder ? folder + "/" + filename : filename;
      const result = yield* Effect.result(
        writeCommand(Effect.suspend(() => write(path, text, payload))),
      );
      if (Result.isSuccess(result))
        return { path: result.success, frontmatter: payload.frontmatter };
      if (result.failure._tag === "NoteWriteError") return yield* Effect.fail(result.failure);
    }
    return yield* Effect.fail(new NotePathTakenError());
  });
}
