import { eventually } from "../support/wait";
import { Effect } from "effect";
import { Plugin } from "obsidian";
import { afterEach, expect, it, vi } from "vitest";
import { clearNotices, createTestPlugin, recordedNotices } from "@test/obsidian";
import { bootstrap, reportUnloadFailure } from "../../src/bootstrap";
import ShellPlugin from "../../src/main";

vi.mock("obsidian", () => import("@test/obsidian"));

afterEach(() => {
  clearNotices();
  vi.restoreAllMocks();
});

class TestPlugin extends Plugin {}

it("disposes an aborted bootstrap and returns an inert handle", async () => {
  const { plugin, registry } = createTestPlugin(TestPlugin);
  const controller = new AbortController();
  registry.holdLoadData();
  const loadData = vi.spyOn(registry.plugin, "loadData");

  const boot = bootstrap(plugin, { signal: controller.signal });
  await eventually(() => expect(loadData).toHaveBeenCalledOnce());
  controller.abort();
  registry.releaseLoadData();
  const handle = await boot;
  await expect(handle.runtime.runPromise(Effect.void)).rejects.toThrow("ManagedRuntime disposed");
  await expect(handle.reloadSettings()).resolves.toBeUndefined();
  await expect(handle.dispose()).resolves.toBeUndefined();
  expect([
    registry.commands.size,
    registry.views.size,
    registry.settingTabs.length,
    registry.ribbonIcons.size,
  ]).toEqual([0, 0, 0, 0]);
});

it("abandons a pending plugin load when Obsidian unloads it", async () => {
  const { plugin, registry } = createTestPlugin(ShellPlugin);
  registry.holdLoadData();
  const loadData = vi.spyOn(registry.plugin, "loadData");

  const boot = registry.load();
  await eventually(() => expect(loadData).toHaveBeenCalledOnce());
  plugin.unload();
  registry.releaseLoadData();
  await expect(boot).resolves.toBeUndefined();
  expect([
    registry.commands.size,
    registry.views.size,
    registry.settingTabs.length,
    registry.ribbonIcons.size,
  ]).toEqual([0, 0, 0, 0]);
});

it("reports a failed command registration and leaves no partially loaded shell", async () => {
  const { plugin, registry } = createTestPlugin(ShellPlugin);
  const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  const loadData = vi.spyOn(registry.plugin, "loadData");
  registry.failNextAddCommand({ after: true });
  try {
    await expect(registry.load()).rejects.toThrow("Test addCommand failed after registration");
    await registry.writeExternally({ logLevel: "info" });

    expect(loadData).toHaveBeenCalledOnce();
    expect([
      registry.commands.size,
      registry.views.size,
      registry.settingTabs.length,
      registry.ribbonIcons.size,
    ]).toEqual([0, 0, 0, 0]);
    expect(registry.notices).toHaveLength(1);
    expect(registry.notices[0]).toMatch(/Product Engineering.*[0-9A-Z]{6}/s);
    expect(registry.notices[0]).not.toContain("Test addCommand");
    expect(consoleError).toHaveBeenCalledOnce();
  } finally {
    plugin.unload();
  }
});

it("uses the last-resort unload reporter when the runtime is gone", async () => {
  const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  await Promise.resolve(reportUnloadFailure(new Error("private unload frame")));
  expect(consoleError).toHaveBeenCalledExactlyOnceWith(
    "[product-engineering]",
    expect.objectContaining({
      event: "plugin.unload.failed",
      incidentId: expect.stringMatching(/^[0-9A-Z]{6}$/) as unknown,
    }),
  );
  expect(recordedNotices()).toHaveLength(1);
  expect(recordedNotices()[0]).toMatch(/Product Engineering.*[0-9A-Z]{6}/s);
  expect(recordedNotices()[0]).not.toContain("private unload frame");
});
