// @vitest-environment happy-dom
import { Effect } from "effect";
import { Plugin } from "obsidian";
import { expect, it, vi } from "vitest";
import { App, createTestPlugin } from "@test/obsidian";
import { NoteStore, NoteTrashError } from "../../../../src/application/notes";
import { newNoteText } from "../../../../src/application/notes/adapter";
import { notesAdapters } from "../../../../src/infrastructure/obsidian/notes";
import { noteStoreContract } from "../../../support/notes/contract";
import type { NoteStoreFixture, SeedFrontmatter } from "../../../support/notes/fixture";

vi.mock("obsidian", () => import("@test/obsidian"));

function noteText(frontmatter: SeedFrontmatter, body: string): string {
  if (frontmatter === "none") return body;
  if (frontmatter === "broken") return "---\ninvalid: [\n---\n" + body;
  return newNoteText(frontmatter, body);
}

function makeFixture(caseInsensitive: boolean): NoteStoreFixture {
  const app = new App({ caseInsensitive });
  const { plugin } = createTestPlugin(class extends Plugin {}, { app });
  const { vault, metadataCache } = app;

  return {
    layer: notesAdapters(plugin).noteStore,
    seed: (path, frontmatter, body = "") =>
      Effect.promise(async () => {
        await vault.seedFile(path, noteText(frontmatter, body));
      }),
    removeOutside: (path) => Effect.promise(() => vault.removeOutside(path)),
    settle: Effect.promise(() => metadataCache.whenIndexed()),
    body: (path) =>
      Effect.promise(async () => {
        const file = vault.getFileByPath(path);
        if (!file) return;
        return (await vault.read(file)).replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, "");
      }),
    isFolder: (path) => vault.getFolderByPath(path) !== null,
    setFailReads: (value) => {
      vault.failReads = value;
    },
    setFailWrites: (value) => {
      vault.failWrites = value;
    },
    holdWrites: () => vault.holdWrites(),
    releaseWrites: () => vault.releaseWrites(),
    heldWrites: () => vault.heldWrites(),
  };
}

noteStoreContract("Obsidian NoteStore on a case-sensitive vault", () => makeFixture(false));
noteStoreContract("Obsidian NoteStore on a case-insensitive vault", () => makeFixture(true));

async function trashFixture() {
  const app = new App();
  const { plugin } = createTestPlugin(class extends Plugin {}, { app });
  const file = await app.vault.seedFile("Trash fixture.md", "Keep when trash is refused.");
  const trash = NoteStore.use((store) => store.trash(file.path)).pipe(
    Effect.provide(notesAdapters(plugin).noteStore),
  );
  return { app, file, trash };
}

it("reports a typed error when Obsidian resolves false for a refused trash move", async () => {
  const { app, file, trash } = await trashFixture();
  const hostTrash = vi.spyOn(app.fileManager, "trashFile").mockResolvedValue(false);

  const failure = await Effect.runPromise(
    Effect.match(trash, { onSuccess: () => undefined, onFailure: (error) => error }),
  );
  expect(failure).toBeInstanceOf(NoteTrashError);
  expect(hostTrash).toHaveBeenCalledExactlyOnceWith(file);
  expect(app.vault.getFileByPath(file.path)).toBe(file);
});

it("accepts a completed native trash move with the declared void result", async () => {
  const { app, file, trash } = await trashFixture();
  const nativeTrash = app.fileManager.trashFile.bind(app.fileManager);
  const legacy: { trashFile(target: typeof file): Promise<boolean | void> } = app.fileManager;
  vi.spyOn(legacy, "trashFile").mockImplementation(async (target) => {
    await nativeTrash(target);
  });

  await expect(Effect.runPromise(trash)).resolves.toBeUndefined();
  expect(app.vault.getFileByPath(file.path)).toBeNull();
});
