import { Effect, Layer, ManagedRuntime } from "effect";
import { Plugin } from "obsidian";
import { expect, it, vi } from "vitest";
import { createTestPlugin } from "@test/obsidian";
import type { AppEvent } from "../../../../src/application/events";
import { EventBus } from "../../../../src/application/shell";
import { hostEventsLayer } from "../../../../src/infrastructure/obsidian/shell";
import { testRuntime } from "../../../support/runtime";

vi.mock("obsidian", () => import("@test/obsidian"));

async function readinessFixture(layoutReady = false) {
  const { plugin, registry } = createTestPlugin(class extends Plugin {}, { layoutReady });
  const { workspace, vault, metadataCache } = registry.plugin.app;
  const services = testRuntime();
  const bus = await services.runtime.runPromise(EventBus);
  const published = vi.spyOn(bus, "publish");
  const shell = Layer.succeedContext(await services.runtime.context());
  const host = ManagedRuntime.make(Layer.provide(hostEventsLayer(plugin), shell));
  return {
    workspace,
    vault,
    metadataCache,
    tags: () => published.mock.calls.map(([event]) => event._tag),
    events: (): AppEvent[] => published.mock.calls.flat(),
    start: () => host.runPromise(Effect.void),
    dispose: async () => {
      await host.dispose();
      await services.runtime.dispose();
    },
    logger: services.logger,
    notifier: services.notifier,
  };
}

it("publishes warm and running readiness immediately and never republishes on resolved", async () => {
  const fixture = await readinessFixture(true);
  try {
    await fixture.vault.seedFile("Warm.md", "# Plain Markdown");
    await fixture.metadataCache.whenIndexed();
    await fixture.start();
    expect(fixture.events()).toEqual([{ _tag: "LayoutReady" }, { _tag: "VaultReady" }]);

    await fixture.metadataCache.resolveAll();
    expect(fixture.tags()).toEqual(["LayoutReady", "VaultReady"]);
    expect(fixture.metadataCache.listenerCount("resolved")).toBe(1);
  } finally {
    await fixture.dispose();
  }
  expect(fixture.metadataCache.listenerCount("resolved")).toBe(0);
});

it("waits past layout and early resolved notifications until all cold Markdown is indexed", async () => {
  const fixture = await readinessFixture();
  try {
    await fixture.vault.seedFile("Record.md", "---\ntitle: Record\n---\n");
    await fixture.vault.seedFile("Plain.md", "# Plain Markdown");
    await fixture.metadataCache.whenIndexed();
    await fixture.start();

    const indexing = fixture.metadataCache.startCold();
    fixture.metadataCache.trigger("resolved");
    expect(fixture.events()).toEqual([]);
    fixture.workspace.markLayoutReady();
    fixture.metadataCache.trigger("resolved");
    expect(fixture.tags()).toEqual(["LayoutReady"]);
    await indexing;

    expect(fixture.tags()).toEqual([
      "LayoutReady",
      "MetadataChanged",
      "MetadataChanged",
      "VaultReady",
    ]);
    expect(
      fixture.vault
        .getMarkdownFiles()
        .every((file) => fixture.metadataCache.getFileCache(file) !== null),
    ).toBe(true);
  } finally {
    await fixture.dispose();
  }
});

it("skips a deleted blocker and waits for a Markdown file discovered by the last scan", async () => {
  const fixture = await readinessFixture();
  try {
    const { vault, metadataCache, workspace } = fixture;
    await vault.seedFile("Deleted.md", "# Old");
    await metadataCache.whenIndexed();
    const native = metadataCache.getFileCache.bind(metadataCache);
    const hidden = new Set(["Deleted.md", "New.md"]);
    vi.spyOn(metadataCache, "getFileCache").mockImplementation((file) =>
      hidden.has(file.path) ? null : native(file),
    );
    await fixture.start();
    workspace.markLayoutReady();
    await vault.seedFile("New.md", "# New");
    await metadataCache.whenIndexed();
    await vault.removeOutside("Deleted.md");
    expect(fixture.tags()).not.toContain("VaultReady");

    hidden.delete("New.md");
    metadataCache.trigger("resolved");
    expect(fixture.tags()).toEqual([
      "LayoutReady",
      "FileCreated",
      "MetadataChanged",
      "FileDeleted",
      "VaultReady",
    ]);
  } finally {
    await fixture.dispose();
  }
});

it("does two directory scans and linear cache lookups across a cold startup", async () => {
  const fixture = await readinessFixture();
  try {
    const { vault, metadataCache, workspace } = fixture;
    const size = 50;
    const files = await Promise.all(
      Array.from({ length: size }, (_, i) => vault.seedFile(`Note ${i}.md`, "# Text")),
    );
    await metadataCache.whenIndexed();
    const hidden = new Set(files);
    const native = metadataCache.getFileCache.bind(metadataCache);
    const lookup = vi
      .spyOn(metadataCache, "getFileCache")
      .mockImplementation((file) => (hidden.has(file) ? null : native(file)));
    const scan = vi.spyOn(vault, "getMarkdownFiles");
    await fixture.start();
    workspace.markLayoutReady();
    for (const file of files) {
      hidden.delete(file);
      metadataCache.trigger("resolved");
    }

    expect(fixture.tags()).toEqual(["LayoutReady", "VaultReady"]);
    expect(scan).toHaveBeenCalledTimes(2);
    expect(lookup.mock.calls.length).toBeLessThanOrEqual(size * 4);
  } finally {
    await fixture.dispose();
  }
});

it("reports a cache read defect and lets a later resolved notification retry", async () => {
  const fixture = await readinessFixture();
  try {
    await fixture.vault.seedFile("Cached.md", "# Text");
    await fixture.metadataCache.whenIndexed();
    vi.spyOn(fixture.metadataCache, "getFileCache").mockImplementationOnce(() => {
      throw new Error("Native cache lookup failed");
    });
    await fixture.start();
    expect(() => fixture.workspace.markLayoutReady()).not.toThrow();
    expect(fixture.tags()).toEqual(["LayoutReady"]);
    expect(fixture.logger).toMatchObject([{ level: "error", event: "defect.reported" }]);
    expect(fixture.notifier).toHaveLength(1);

    fixture.metadataCache.trigger("resolved");
    expect(fixture.tags()).toEqual(["LayoutReady", "VaultReady"]);
  } finally {
    await fixture.dispose();
  }
});
