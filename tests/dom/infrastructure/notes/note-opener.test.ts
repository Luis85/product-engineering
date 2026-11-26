import { Effect } from "effect";
import { Plugin } from "obsidian";
import { expect, it, vi } from "vitest";
import { createTestPlugin } from "@test/obsidian";
import { NoteOpener } from "../../../../src/application/notes";
import { newNoteText } from "../../../../src/domain/notes";
import { notesAdapters } from "../../../../src/infrastructure/obsidian/notes";
import { contractOpener } from "../../../support/notes/contract-opener";
import { sampleFrontmatter } from "../../../support/notes/fixture";

vi.mock("obsidian", () => import("@test/obsidian"));

function fixture() {
  const { plugin, registry } = createTestPlugin(class extends Plugin {});
  const { vault, workspace, metadataCache } = registry.plugin.app;
  const opened: string[] = [];
  const getLeaf = workspace.getLeaf.bind(workspace);
  const requested = vi.spyOn(workspace, "getLeaf").mockImplementation((mode) => {
    const leaf = getLeaf(mode);
    const openFile = leaf.openFile.bind(leaf);
    vi.spyOn(leaf, "openFile").mockImplementation((file) => {
      opened.push(file.path);
      return openFile(file);
    });
    return leaf;
  });
  return {
    opener: notesAdapters(plugin).noteOpener,
    seed: (path: string) =>
      Effect.promise(async () => {
        await vault.seedFile(path, newNoteText(sampleFrontmatter, ""));
      }),
    settle: Effect.promise(() => metadataCache.whenIndexed()),
    opened: () => opened,
    requested,
  };
}

contractOpener(fixture);

it("opens a note in a new tab so the routed plugin tab stays in its place", async () => {
  const host = fixture();
  await Effect.runPromise(host.seed("Note.md"));
  const open = NoteOpener.use((opener) => opener.open("Note.md"));
  await Effect.runPromise(Effect.provide(open, host.opener));
  expect(host.requested).toHaveBeenCalledExactlyOnceWith("tab");
});
