import { Effect, Layer } from "effect";
import type { App } from "obsidian";
import { NoteNotFoundError, NoteOpener } from "../../../application/notes";
import { VaultReadError } from "../../../application/shell";
import { noteFile } from "./note-store";

export function noteOpenerLayer(app: App) {
  return Layer.succeed(NoteOpener, {
    open: (path) =>
      Effect.gen(function* () {
        const file = yield* Effect.try({
          try: () => noteFile(app.vault, path),
          catch: () => new VaultReadError(),
        });
        if (!file) return yield* new NoteNotFoundError();

        yield* Effect.tryPromise({
          try: () => app.workspace.getLeaf("tab").openFile(file, { active: true }),
          catch: () =>
            noteFile(app.vault, file.path) === file
              ? new VaultReadError()
              : new NoteNotFoundError(),
        });
      }),
  });
}
