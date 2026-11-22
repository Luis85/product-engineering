import { Effect, Layer } from "effect";
import { Plugin } from "obsidian";
import { expect, it, vi } from "vitest";
import { createTestPlugin } from "@test/obsidian";
import { EventBus } from "../../../../src/application/shell";
import { hostEventsLayer } from "../../../../src/infrastructure/obsidian/shell";
import { testRuntime } from "../../../support/runtime";

vi.mock("obsidian", () => import("@test/obsidian"));

function hostedRuntime() {
  const { plugin, registry } = createTestPlugin(class extends Plugin {}, { layoutReady: false });
  const { workspace, vault, metadataCache, fileManager } = registry.plugin.app;
  const registration = vi.spyOn(workspace, "onLayoutReady");
  const fixture = testRuntime({ hostEvents: hostEventsLayer(plugin) });
  return { ...fixture, workspace, registration, vault, metadataCache, fileManager };
}

it("maps each file event after layout readiness and disposes each listener", async () => {
  const fixture = hostedRuntime();
  const { vault, metadataCache, workspace } = fixture;
  const counts = () => [
    vault.listenerCount("create"),
    vault.listenerCount("modify"),
    vault.listenerCount("rename"),
    vault.listenerCount("delete"),
    metadataCache.listenerCount("changed"),
    metadataCache.listenerCount("resolved"),
  ];
  const bus = await fixture.runtime.runPromise(EventBus);
  const publish = vi.spyOn(bus, "publish");
  try {
    await vault.seedFile("Before.md", "Skipped");
    await metadataCache.whenIndexed();
    expect(publish).not.toHaveBeenCalled();
    workspace.markLayoutReady();
    expect(counts()).toEqual([1, 1, 1, 1, 1, 1]);
    await vault.seedFile("Work/Item.md", "Created");
    await metadataCache.whenIndexed();
    await vault.seedFile("Work/Item.md", "Changed");
    await metadataCache.whenIndexed();
    const item = vault.getFileByPath("Work/Item.md");
    expect(item).toBeDefined();
    if (!item) throw new Error("Expected the seeded file");
    await fixture.fileManager.renameFile(item, "Work/Renamed.md");
    await fixture.fileManager.trashFile(item);
    expect(publish.mock.calls.flat()).toEqual([
      { _tag: "LayoutReady" },
      { _tag: "VaultReady" },
      { _tag: "FileCreated", path: "Work/Item.md", extension: "md" },
      { _tag: "MetadataChanged", path: "Work/Item.md", extension: "md" },
      { _tag: "FileModified", path: "Work/Item.md", extension: "md" },
      { _tag: "MetadataChanged", path: "Work/Item.md", extension: "md" },
      { _tag: "FileRenamed", path: "Work/Renamed.md", oldPath: "Work/Item.md", extension: "md" },
      { _tag: "FileDeleted", path: "Work/Renamed.md", extension: "md" },
    ]);
  } finally {
    await fixture.runtime.dispose();
  }
  expect(counts()).toEqual([0, 0, 0, 0, 0, 0]);
});

it("publishes layout readiness only once and ignores callbacks after disposal", async () => {
  const fixture = hostedRuntime();
  const bus = await fixture.runtime.runPromise(EventBus);
  const publish = vi.spyOn(bus, "publish");
  try {
    expect(publish).not.toHaveBeenCalled();
    expect(fixture.registration).toHaveBeenCalledOnce();
    fixture.workspace.markLayoutReady();
    fixture.registration.mock.calls[0]?.[0]();
    expect(publish.mock.calls.flat()).toEqual([{ _tag: "LayoutReady" }, { _tag: "VaultReady" }]);
  } finally {
    await fixture.runtime.dispose();
  }
  fixture.registration.mock.calls[0]?.[0]();
  expect(publish).toHaveBeenCalledTimes(2);
});

it("ignores a first layout callback after shutdown", async () => {
  const fixture = hostedRuntime();
  const bus = await fixture.runtime.runPromise(EventBus);
  const publish = vi.spyOn(bus, "publish");
  await fixture.runtime.dispose();
  fixture.workspace.markLayoutReady();
  expect(publish).not.toHaveBeenCalled();
});

it("reports a mapping or publication defect at the host boundary", async () => {
  const fixture = hostedRuntime();
  try {
    const bus = await fixture.runtime.runPromise(EventBus);
    vi.spyOn(bus, "publish").mockImplementationOnce(() => {
      throw new Error("host callback failed");
    });
    expect(() => fixture.workspace.markLayoutReady()).not.toThrow();
    expect(fixture.logger).toMatchObject([
      { level: "error", event: "defect.reported", incidentId: "T-1" },
    ]);
    expect(fixture.notifier).toHaveLength(1);
  } finally {
    await fixture.runtime.dispose();
  }
});

it("can build a host without an event producer", async () => {
  const fixture = testRuntime({ hostEvents: Layer.empty });
  try {
    await expect(fixture.runtime.runPromise(Effect.void)).resolves.toBeUndefined();
  } finally {
    await fixture.runtime.dispose();
  }
});
