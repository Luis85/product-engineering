import { Effect, Result } from "effect";
import { Plugin } from "obsidian";
import { expect, it, vi } from "vitest";
import { createTestPlugin } from "@test/obsidian";
import { NoteStore } from "../../../../src/application/notes";
import { newNoteText } from "../../../../src/domain/notes";
import { noteStoreLayer } from "../../../../src/infrastructure/obsidian/notes";
import { hostEventsLayer } from "../../../../src/infrastructure/obsidian/shell";
import type { NoteStoreFixture } from "../../../support/notes/fixture";
import { expectedStoreEvents, observeStoreEvents } from "../../../support/notes/store-events";
import { testRuntime } from "../../../support/runtime";

vi.mock("obsidian", () => import("@test/obsidian"));

it("publishes the store's common file events through the host", async () => {
  const { plugin, registry } = createTestPlugin(class extends Plugin {});
  const app = registry.plugin.app;
  const { runtime } = testRuntime({ hostEvents: hostEventsLayer(plugin) });
  const seed: NoteStoreFixture["seed"] = (path, frontmatter, body = "") =>
    Effect.promise(async () => {
      const text = typeof frontmatter === "string" ? body : newNoteText(frontmatter, body);
      await app.vault.seedFile(path, text);
    });
  try {
    const events = await runtime.runPromise(
      NoteStore.use((store) =>
        observeStoreEvents(store, {
          seed,
          settle: Effect.promise(() => app.metadataCache.whenIndexed()),
        }),
      ).pipe(Effect.provide(noteStoreLayer(plugin.app))),
    );
    expect(events).toEqual(expectedStoreEvents);
  } finally {
    await runtime.dispose();
  }
});

it("reads revoked permission from disk while the metadata cache still reports access", async () => {
  const { plugin, registry } = createTestPlugin(class extends Plugin {});
  const { vault, metadataCache } = registry.plugin.app;
  const path = "Projects/Kundenportal/Project.md";
  const file = await vault.seedFile(
    path,
    newNoteText({ schema: "product-engineering.project/v1", mcp_read: true }),
  );
  await metadataCache.whenIndexed();
  const cached = metadataCache.getFileCache(file);
  vi.spyOn(metadataCache, "getFileCache").mockReturnValue(cached);
  const store = await Effect.runPromise(Effect.provide(NoteStore, noteStoreLayer(plugin.app)));
  await Effect.runPromise(store.update(path, () => Result.succeed({ set: { mcp_read: false } })));
  expect((await Effect.runPromise(store.read(path))).frontmatter.mcp_read).toBe(true);
  expect((await Effect.runPromise(store.readFresh(path))).frontmatter.mcp_read).toBe(false);
  await expect(Effect.runPromise(store.readFresh("missing.md"))).rejects.toMatchObject({
    _tag: "NoteNotFoundError",
  });
  await vault.process(file, () => "---\nmcp_read: [\n---\n");
  await expect(Effect.runPromise(store.readFresh(path))).rejects.toMatchObject({
    _tag: "NoteUnreadableError",
  });
});
