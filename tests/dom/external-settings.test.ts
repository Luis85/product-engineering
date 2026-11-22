import { eventually } from "../support/wait";
import { afterEach, expect, it, vi } from "vitest";
import { clearNotices, createTestPlugin, DropdownComponent, settingsIn } from "@test/obsidian";
import ShellPlugin from "../../src/main";

vi.mock("obsidian", () => import("@test/obsidian"));

afterEach(() => {
  clearNotices();
  vi.restoreAllMocks();
});

it("displays external settings, falls back per field, and never rewrites a newer file", async () => {
  const { plugin, registry } = createTestPlugin(ShellPlugin, { data: { logLevel: "info" } });
  try {
    await registry.load();
    const tab = registry.settingTabs[0];
    if (!tab) throw new Error("Settings tab was not registered");
    tab.update();
    expect(tab.getControlValue("logLevel")).toBe("info");

    await registry.writeExternally({ schemaVersion: 1, logLevel: "debug" });
    expect(tab.getControlValue("logLevel")).toBe("debug");

    await registry.writeExternally({
      schemaVersion: 1,
      logLevel: "invalid",
      unrelated: "untouched",
    });
    expect(tab.getControlValue("logLevel")).toBe("warn");
    expect(registry.notices.at(-1)).toContain("Einige Einstellungen wurden zurückgesetzt");

    await registry.writeExternally({ schemaVersion: 2, logLevel: "debug" });
    const control = settingsIn(tab).get("logLevel")?.control;
    if (!(control instanceof DropdownComponent)) throw new Error("Log level dropdown is missing");
    expect(control.selectEl.disabled).toBe(true);
    await Promise.resolve(tab.setControlValue("logLevel", "error"));
    expect(registry.saved).toEqual([]);
  } finally {
    plugin.unload();
  }
});

it("waits for the current load before reloading and ignores changes after unload", async () => {
  const { plugin, registry } = createTestPlugin(ShellPlugin);
  registry.holdLoadData();
  const loadData = vi.spyOn(registry.plugin, "loadData");

  try {
    const load = registry.load();
    await eventually(() => expect(loadData).toHaveBeenCalledOnce());
    const change = registry.writeExternally({ schemaVersion: 1, logLevel: "debug" });
    expect(registry.settingTabs).toHaveLength(0);
    registry.releaseLoadData();
    await Promise.all([load, change]);
    expect(registry.settingTabs[0]?.getControlValue("logLevel")).toBe("debug");
    expect(loadData).toHaveBeenCalledTimes(2);
  } finally {
    registry.releaseLoadData();
    plugin.unload();
  }
  await registry.writeExternally({ logLevel: "error" });
  expect(loadData).toHaveBeenCalledTimes(2);
  expect(registry.saved).toEqual([]);
});
