import { Effect, Option, Stream } from "effect";
import { Plugin } from "obsidian";
import { expect, it, vi } from "vitest";
import { createTestPlugin } from "@test/obsidian";
import { referenceVault } from "../../../../scripts/reference-vault.mjs";
import { appServicesLayer } from "../../../../src/application/app-services-layer";
import { noteChanges, noteSnapshot } from "../../../../src/application/notes";
import { noteStoreLayer } from "../../../../src/infrastructure/obsidian/notes";
import { hostEventsLayer } from "../../../../src/infrastructure/obsidian/shell";
import { makeRuntime } from "../../../../src/infrastructure/runtime";
import { testAdapters } from "../../../support/adapters";
import {
  referenceEntryType,
  referenceItemType,
  referenceNoteTypes,
} from "../../../support/notes/reference-types";

vi.mock("obsidian", () => import("@test/obsidian"));

it("builds from the cold cache and follows outside edits after metadata changes", async () => {
  const { plugin, registry } = createTestPlugin(class extends Plugin {}, { layoutReady: false });
  const app = registry.plugin.app;
  await Promise.all(
    Array.from(referenceVault({ items: 1, records: 2, plain: 1 }), ([path, text]) =>
      app.vault.seedFile(path, text),
    ),
  );
  await app.metadataCache.whenIndexed();

  const { adapters } = testAdapters();
  const layer = appServicesLayer(
    { ...adapters, noteStore: noteStoreLayer(plugin.app), hostEvents: hostEventsLayer(plugin) },
    { noteTypes: referenceNoteTypes, language: "en", developmentMode: true },
  );
  const runtime = makeRuntime(layer);
  try {
    const snapshot = noteSnapshot(referenceItemType);
    const changes = noteChanges(referenceItemType);
    expect(await runtime.runPromise(snapshot)).toMatchObject({ ready: false, notes: [] });

    const ready = runtime.runPromise(
      changes.pipe(
        Stream.filter((state) => state.ready),
        Stream.runHead,
        Effect.timeout("4 seconds"),
      ),
    );
    const cold = app.metadataCache.startCold();
    app.workspace.markLayoutReady();
    const [first] = await Promise.all([ready, cold]);
    const path = "Items/Item 1.md";
    expect(Option.getOrThrow(first).notes.map((note) => note.path)).toEqual([path]);
    const entries = await runtime.runPromise(
      noteChanges(referenceEntryType).pipe(
        Stream.filter((state) => state.ready),
        Stream.runHead,
        Effect.timeout("4 seconds"),
      ),
    );
    expect(Option.getOrThrow(entries).notes.map((note) => note.values.title)).toEqual(["Entry 1"]);

    const file = app.vault.getFileByPath(path);
    if (!file) throw new Error("Reference item was not created");
    await app.vault.process(file, (text) =>
      text.replace("title: Item 1", "title: Changed outside"),
    );
    expect((await runtime.runPromise(snapshot)).notes[0]?.values.title).toBe("Item 1");
    const edited = await runtime.runPromise(
      changes.pipe(
        Stream.filter(({ notes }) => notes[0]?.values.title === "Changed outside"),
        Stream.runHead,
        Effect.timeout("4 seconds"),
      ),
    );
    expect(Option.getOrThrow(edited).notes[0]?.path).toBe(path);
  } finally {
    await runtime.dispose();
    plugin.unload();
  }
});
