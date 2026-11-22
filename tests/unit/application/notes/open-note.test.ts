import { Effect, Layer } from "effect";
import { expect, it, vi } from "vitest";
import { NoteNotFoundError, NoteOpener, openNote } from "../../../../src/application/notes";

it("opens a vault path through the note opener", async () => {
  const open = vi.fn<(path: string) => Effect.Effect<void>>().mockReturnValue(Effect.void);
  await Effect.runPromise(
    openNote("Folder/Draft.md").pipe(Effect.provide(Layer.succeed(NoteOpener, { open }))),
  );
  expect(open).toHaveBeenCalledExactlyOnceWith("Folder/Draft.md");
});

it("preserves the missing-note failure", async () => {
  const missing = Effect.flip(openNote("deleted.md")).pipe(
    Effect.provide(Layer.succeed(NoteOpener, { open: () => Effect.fail(new NoteNotFoundError()) })),
  );
  await expect(Effect.runPromise(missing)).resolves.toMatchObject({ _tag: "NoteNotFoundError" });
});
