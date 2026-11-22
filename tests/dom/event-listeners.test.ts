import { expect, it, vi } from "vitest";
import { createTestPlugin } from "@test/obsidian";
import ShellPlugin from "../../src/main";

vi.mock("obsidian", () => import("@test/obsidian"));

it("cleans up host listeners synchronously on every plugin unload", async () => {
  const { plugin, registry } = createTestPlugin(ShellPlugin);
  const { vault, metadataCache, workspace } = registry.plugin.app;
  const counts = () => [
    vault.listenerCount("create"),
    vault.listenerCount("modify"),
    vault.listenerCount("delete"),
    vault.listenerCount("rename"),
    metadataCache.listenerCount("changed"),
  ];
  const baseline = counts();

  const cycle = async () => {
    await registry.load();
    expect(workspace.layoutReady).toBe(true);
    expect(counts()).toEqual(baseline.map((count) => count + 1));
    plugin.unload();
    expect(counts()).toEqual(baseline);
  };
  await cycle();
  await cycle();
  await cycle();
});
