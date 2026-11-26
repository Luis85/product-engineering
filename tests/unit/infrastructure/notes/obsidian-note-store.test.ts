// @vitest-environment happy-dom
import { Cause, Effect, Exit, Result } from "effect";
import { Plugin } from "obsidian";
import { expect, it, vi } from "vitest";
import { App, createTestPlugin } from "@test/obsidian";
import { NoteStore, NoteTrashError } from "../../../../src/application/notes";
import type { FrontmatterChange } from "../../../../src/application/notes";
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

noteStoreContract("Obsidian NoteStore on a case-sensitive vault", () => makeFixture(false), {
  caseSensitive: true,
});
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

const fidelityText = [
  "---",
  "# Properties",
  "status: open  # comment to keep",
  "zip: 01067",
  "version: 1.10",
  "large: 12345678901234567890",
  "flow: [a, b]",
  "flag: 'yes'",
  "'quoted-key': value  # here too",
  "list:",
  "- one",
  "- two",
  "description: |",
  "  note content",
  "---",
  "# Body",
  "keep trailing spaces  ",
  "",
].join("\n");

async function updateFixture(text = fidelityText) {
  const app = new App();
  const { plugin } = createTestPlugin(class extends Plugin {}, { app });
  const file = await app.vault.seedFile("Byte fidelity.md", text);
  await app.metadataCache.whenIndexed();
  const layer = notesAdapters(plugin).noteStore;
  return {
    raw: () => app.vault.process(file, (contents) => contents),
    onModify: (callback: () => void) => app.vault.on("modify", callback),
    update: <E>(change: FrontmatterChange<E>) =>
      NoteStore.use((store) => store.update(file.path, change)).pipe(Effect.provide(layer)),
  };
}

it.each([
  ["LF", fidelityText],
  ["BOM", "\uFEFF" + fidelityText],
  ["CRLF", fidelityText.replaceAll("\n", "\r\n")],
  ["BOM and CRLF", "\uFEFF" + fidelityText.replaceAll("\n", "\r\n")],
])("saves changed frontmatter with %s byte fidelity", async (_label, text) => {
  const { raw, update } = await updateFixture(text);
  const saved = await Effect.runPromise(update(() => Result.succeed({ set: { status: "done" } })));

  expect(saved).toMatchObject({ path: "Byte fidelity.md", frontmatter: { status: "done" } });
  await expect(raw()).resolves.toBe(text.replace("status: open", "status: done"));
});

it("skips the Obsidian write on a no-op or a typed patch failure", async () => {
  const { raw, onModify, update } = await updateFixture();
  const modified = vi.fn<() => void>();
  onModify(modified);
  const rejection = { _tag: "PatchRejected" } as const;

  const unchanged = await Effect.runPromise(
    update(() => Result.succeed({ set: { status: "open" } })),
  );
  expect(unchanged.frontmatter.status).toBe("open");
  await expect(
    Effect.runPromise(Effect.result(update(() => Result.fail(rejection)))),
  ).resolves.toEqual(Result.fail(rejection));
  await expect(raw()).resolves.toBe(fidelityText);
  expect(modified).not.toHaveBeenCalled();
});

it("retains a thrown change as a defect and leaves the note untouched", async () => {
  const { raw, onModify, update } = await updateFixture();
  const modified = vi.fn<() => void>();
  onModify(modified);
  const defect = new Error("Broken edit callback");

  const exit = await Effect.runPromise(
    Effect.exit(
      update(() => {
        throw defect;
      }),
    ),
  );
  if (!Exit.isFailure(exit)) throw new Error("Expected the thrown change to fail the update");
  expect(Cause.hasDies(exit.cause)).toBe(true);
  expect(Cause.squash(exit.cause)).toBe(defect);
  await expect(raw()).resolves.toBe(fidelityText);
  expect(modified).not.toHaveBeenCalled();
});
