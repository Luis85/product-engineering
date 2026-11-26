import { Plugin } from "obsidian";
import { expect, it, vi } from "vitest";
import { createTestPlugin, DropdownComponent, settingsIn } from "@test/obsidian";
import { catalogFor } from "../../../../src/application/messages";
import { mirrorSettings, ShellSettingTab } from "../../../../src/infrastructure/obsidian/shell";
import { testRuntime } from "../../../support/runtime";

vi.mock("obsidian", () => import("@test/obsidian"));

class TestPlugin extends Plugin {}
const dropdownSelector = "select.dropdown:not(.is-measuring)";

it("presents one validated log level dropdown and persists a selection", async () => {
  const { plugin } = createTestPlugin(TestPlugin);
  const fixture = testRuntime({ initialSettings: { logLevel: "info" } });
  const mirror = await mirrorSettings(fixture.runtime);
  try {
    const tab = new ShellSettingTab(
      plugin.app,
      plugin,
      fixture.runtime,
      mirror,
      catalogFor("de").shell,
    );
    tab.update();
    const entries = settingsIn(tab);
    expect([...entries.keys()]).toEqual(["logLevel"]);
    const control = entries.get("logLevel")?.control;
    if (!(control instanceof DropdownComponent)) throw new Error("Log level dropdown is missing");

    expect([...control.selectEl.options].map(({ value, text }) => [value, text])).toEqual([
      ["error", "Fehler"],
      ["warn", "Warnung"],
      ["info", "Info"],
      ["debug", "Debug"],
    ]);
    expect(control.selectEl.value).toBe("info");
    const definition = tab
      .getSettingDefinitions()
      .find((item) => "control" in item && item.control?.type === "dropdown");
    if (!definition || !("control" in definition) || definition.control?.type !== "dropdown") {
      throw new Error("Log level declaration is missing");
    }
    expect(await Promise.resolve(definition.control.validate?.("debug"))).toBeUndefined();
    expect(await Promise.resolve(definition.control.validate?.("verbose"))).toEqual(
      expect.any(String),
    );

    control.selectEl.value = "debug";
    control.selectEl.dispatchEvent(new Event("change"));
    await control.pending;
    expect(fixture.store.saved).toEqual([{ schemaVersion: 1, logLevel: "debug" }]);
    expect(tab.getControlValue("logLevel")).toBe("debug");
    tab.update();
    expect(tab.containerEl.querySelectorAll(dropdownSelector)).toHaveLength(1);
  } finally {
    await mirror.stop();
    await fixture.runtime.dispose();
  }
});

it("renders the reason and issue link beside the disabled read-only dropdown", async () => {
  const { plugin } = createTestPlugin(TestPlugin);
  const fixture = testRuntime({ initialSettings: { schemaVersion: 2, logLevel: "debug" } });
  const mirror = await mirrorSettings(fixture.runtime);
  try {
    const tab = new ShellSettingTab(
      plugin.app,
      plugin,
      fixture.runtime,
      mirror,
      catalogFor("en").shell,
    );
    tab.update();
    tab.update();
    const select = tab.containerEl.querySelector<HTMLSelectElement>(dropdownSelector);
    expect(select?.disabled).toBe(true);
    expect(tab.containerEl.querySelectorAll(dropdownSelector)).toHaveLength(1);
    expect(tab.containerEl.children).toHaveLength(2);
    expect(tab.containerEl.textContent).toContain("This file uses a newer settings version.");
    expect(tab.containerEl.querySelector("a")?.getAttribute("href")).toBe(
      "https://github.com/Luis85/product-engineering/issues",
    );
    await Promise.resolve(tab.setControlValue("logLevel", "debug"));
    expect(fixture.store.saved).toEqual([]);
  } finally {
    await mirror.stop();
    await fixture.runtime.dispose();
  }
});
