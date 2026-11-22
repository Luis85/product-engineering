// @vitest-environment happy-dom
import type { SettingDefinitionItem, ViewStateResult } from "obsidian";
import { afterEach, expect, it, vi } from "vitest";
import {
  App,
  apiVersion,
  clearNotices,
  Component,
  createTestPlugin,
  DEFAULT_TEST_LANGUAGE,
  DropdownComponent,
  Events,
  failNextNotice,
  getLanguage,
  installDomExtensions,
  ItemView,
  normalizePath,
  Notice,
  Platform,
  Plugin,
  PluginSettingTab,
  recordedNotices,
  Setting,
  setLanguage,
  settingsIn,
  TextComponent,
  ToggleComponent,
  View,
  Workspace,
  WorkspaceLeaf,
} from "@test/obsidian";

afterEach(() => {
  vi.restoreAllMocks();
  clearNotices();
  setLanguage(DEFAULT_TEST_LANGUAGE);
});

it("unloads the component before releasing registrations in reverse order", async () => {
  const calls: string[] = [];
  const events = new Events();
  class ProbeComponent extends Component {
    override onload() {
      calls.push("load");
    }
    override onunload() {
      calls.push("unload");
      events.trigger("change");
    }
  }
  const component = new ProbeComponent();
  await component.load();
  component.register(() => calls.push("first"));
  component.registerEvent(events.on("change", () => calls.push("event")));
  component.register(() => {
    expect(events.listenerCount()).toBe(1);
    calls.push("last");
  });

  component.unload();
  component.unload();
  events.trigger("change");

  expect(calls).toEqual(["load", "unload", "event", "last", "first"]);
  expect(events.listenerCount("change")).toBe(0);
});

it("removes DOM listeners and clears its registered interval", async () => {
  const component = new Component();
  const listener = vi.fn<() => void>();
  const element = document.createElement("button");
  const clearInterval = vi.spyOn(window, "clearInterval");
  await component.load();
  component.registerDomEvent(element, "click", listener);
  const interval = window.setInterval(() => undefined, 60_000);
  expect(component.registerInterval(interval)).toBe(interval);

  element.click();
  component.unload();
  element.click();

  expect(listener).toHaveBeenCalledTimes(1);
  expect(clearInterval).toHaveBeenCalledExactlyOnceWith(interval);
});

it("removes event refs by identity, including repeated removal", () => {
  const events = new Events();
  const listener = vi.fn<(value: unknown) => void>();
  const first = events.on("change", listener);
  events.on("change", listener);
  events.offref({});
  events.offref(first);
  events.offref(first);
  events.trigger("change", 3);

  expect(listener).toHaveBeenCalledExactlyOnceWith(3);
  expect(events.listenerCount("change")).toBe(1);
  events.off("change", listener);
  expect(events.listenerCount()).toBe(0);
});

it("registers and unloads commands, views, settings and ribbon entries", async () => {
  const invoked = vi.fn<() => void>();
  class ProbePlugin extends Plugin {
    override onload() {
      this.addCommand({ id: "open", name: "Open", callback: invoked });
      this.registerView("probe", (leaf) => new ProbeView(leaf));
      this.addSettingTab(new PluginSettingTab(this.app, this));
      this.addRibbonIcon("settings", this.manifest.name, invoked);
    }
  }
  const { plugin, registry } = createTestPlugin(ProbePlugin);
  await registry.load();
  const commandId = "product-engineering:open";
  const ribbonId = "product-engineering:Product Engineering";

  expect(registry.commands.get(commandId)?.id).toBe(commandId);
  expect(registry.views.has("probe")).toBe(true);
  expect(registry.settingTabs).toHaveLength(1);
  expect(registry.ribbonIcons.get(ribbonId)?.title).toBe("Product Engineering");
  registry.runCommand(commandId);
  expect(invoked).toHaveBeenCalledOnce();
  plugin.removeCommand("open");
  expect(registry.commands.has(commandId)).toBe(false);

  plugin.unload();
  expect(registry.views.size).toBe(0);
  expect(registry.settingTabs).toHaveLength(0);
  expect(registry.ribbonIcons.size).toBe(0);
});

it("leaves a removed ribbon element registered until normal unload", async () => {
  const { plugin, registry } = createTestPlugin(Plugin);
  await registry.load();
  const icon = plugin.addRibbonIcon("settings", "Example", () => undefined);
  const ribbon = plugin.app.workspace.leftRibbon;
  const key = "product-engineering:Example";
  icon.remove();

  expect(icon.isConnected).toBe(false);
  expect(ribbon.items.get(key)?.element).toBe(icon);
  ribbon.onChange();
  expect(icon.isConnected).toBe(true);

  plugin.unload();
  ribbon.onChange();
  expect(ribbon.items.has(key)).toBe(false);
  expect(icon.isConnected).toBe(false);
});

it("can fail a command before or after registration", () => {
  const { plugin, registry } = createTestPlugin(Plugin);
  const command = { id: "open", name: "Open" };

  registry.failNextAddCommand({});
  expect(() => plugin.addCommand(command)).toThrow("before registration");
  expect(registry.commands.size).toBe(0);

  registry.failNextAddCommand({ after: true });
  expect(() => plugin.addCommand(command)).toThrow("after registration");
  expect(registry.commands.has("product-engineering:open")).toBe(true);
});

it("supports held data loads, failures, saves and external settings changes", async () => {
  const changed = vi.fn<() => void>();
  class ProbePlugin extends Plugin {
    override onExternalSettingsChange = changed;
  }
  const { plugin, registry } = createTestPlugin(ProbePlugin, { data: { version: 1 } });
  registry.setFailLoadData(true);
  await expect(plugin.loadData()).rejects.toThrow("Test loadData failed");
  registry.setFailLoadData(false);

  registry.holdLoadData();
  const load = plugin.loadData();
  const settled = vi.fn<(data: unknown) => void>();
  const result = load.then(settled);
  await Promise.resolve();
  expect(settled).not.toHaveBeenCalled();
  registry.releaseLoadData();
  await result;
  expect(settled).toHaveBeenCalledExactlyOnceWith({ version: 1 });

  await plugin.saveData({ version: 2 });
  expect(registry.saved).toEqual([{ version: 2 }]);
  await registry.writeExternally({ version: 3 });
  expect(changed).toHaveBeenCalledOnce();
  await expect(plugin.loadData()).resolves.toEqual({ version: 3 });
});

class ProbeView extends ItemView {
  readonly calls: unknown[] = [];
  override getViewType() {
    return "probe";
  }
  override onOpen() {
    this.calls.push("open");
    return Promise.resolve();
  }
  override onClose() {
    this.calls.push("close");
    return Promise.resolve();
  }
  override setState(state: unknown, result: ViewStateResult) {
    this.calls.push(state);
    return super.setState(state, result);
  }
}

it("opens a view before setting state and keeps it on same-type changes", async () => {
  const { plugin } = createTestPlugin(Plugin, { layoutReady: false });
  const { workspace } = plugin.app;
  expect(plugin.app).toBeInstanceOf(App);
  expect(workspace).toBeInstanceOf(Workspace);
  const ready = vi.fn<() => void>();
  workspace.onLayoutReady(ready);
  expect(ready).not.toHaveBeenCalled();
  workspace.markLayoutReady();
  workspace.onLayoutReady(ready);
  expect(ready).toHaveBeenCalledTimes(2);

  plugin.registerView("probe", (leaf) => new ProbeView(leaf));
  const leaf = workspace.getLeaf("tab");
  expect(leaf).toBeInstanceOf(WorkspaceLeaf);
  const otherDocument = document.implementation.createHTMLDocument("Test pop-out");
  leaf.openIn(otherDocument);
  const first = { page: "list" };
  const second = { page: "details" };
  await leaf.setViewState({ type: "probe", state: first });
  const view = leaf.view;
  if (!(view instanceof ProbeView)) throw new Error("Expected the registered probe view");
  expect(view).toBeInstanceOf(View);
  await leaf.setViewState({ type: "probe", state: second });

  expect(workspace.leafRequests).toEqual(["tab"]);
  expect(workspace.getLeavesOfType("probe")).toEqual([leaf]);
  expect(leaf.view).toBe(view);
  expect(view.contentEl.ownerDocument).toBe(otherDocument);
  expect(view.navigation).toBe(false);
  expect(view.calls).toEqual(["open", first, second]);
  expect(view.getState()).toEqual(second);

  await workspace.revealLeaf(leaf);
  expect(workspace.revealedLeaves).toEqual([leaf]);
  workspace.requestSaveLayout();
  expect(workspace.layoutSaves).toBe(1);
  const file = { path: "Example.md" };
  await leaf.openFile(file);
  expect(leaf.openedFiles).toEqual([file]);
  await leaf.detach();
  expect(view.calls.at(-1)).toBe("close");
  expect(workspace.getLeavesOfType("probe")).toEqual([]);
});

it("renders settings controls and waits for the change to settle", async () => {
  const { plugin } = createTestPlugin(Plugin);
  class ProbeTab extends PluginSettingTab {
    level = "info";
    readOnly = false;

    override getSettingDefinitions(): SettingDefinitionItem[] {
      const detail = this.containerEl.ownerDocument.createDocumentFragment();
      const link = this.containerEl.ownerDocument.createElement("a");
      link.href = "https://example.invalid/issues";
      link.textContent = "Issue tracker";
      detail.append(link);
      return [
        { name: "Title", control: { type: "text", key: "title", defaultValue: "Default" } },
        { name: "Flag", control: { type: "toggle", key: "flag", defaultValue: true } },
        {
          name: "Log level",
          desc: "Log detail",
          control: {
            type: "dropdown",
            key: "level",
            options: { info: "Info", debug: "Debug" },
            disabled: () => this.readOnly,
          },
        },
        { name: "Read-only settings", desc: detail, visible: this.readOnly },
      ];
    }

    override getControlValue(key: string) {
      return key === "level" ? this.level : undefined;
    }

    override async setControlValue(key: string, value: unknown) {
      await Promise.resolve();
      if (key === "level" && typeof value === "string") this.level = value;
    }
  }
  const tab = new ProbeTab(plugin.app, plugin);
  tab.update();
  const settings = settingsIn(tab);
  const dropdown = settings.get("level")?.control;
  expect(settings.get("title")?.control).toBeInstanceOf(TextComponent);
  expect(settings.get("flag")?.control).toBeInstanceOf(ToggleComponent);
  if (!(dropdown instanceof DropdownComponent)) throw new Error("Dropdown missing");
  expect(dropdown.getValue()).toBe("info");
  expect(settings.get("level")?.setting).toBeInstanceOf(Setting);
  expect(settings.get("level")?.setting.descEl.textContent).toBe("Log detail");
  dropdown.selectEl.value = "debug";
  dropdown.selectEl.dispatchEvent(new Event("change"));
  await dropdown.pending;
  expect(tab.level).toBe("debug");
  tab.readOnly = true;
  tab.update();
  const updated = settingsIn(tab).get("level")?.control;
  expect(updated).toBeInstanceOf(DropdownComponent);
  expect(updated instanceof DropdownComponent && updated.selectEl.disabled).toBe(true);
  expect(tab.containerEl.textContent).toContain("Read-only settings");
  expect(tab.containerEl.querySelector("a")?.getAttribute("href")).toBe(
    "https://example.invalid/issues",
  );
});

it("records notices and lets a test simulate a notice failure", () => {
  const { registry } = createTestPlugin(Plugin);
  expect(new Notice("Message").message).toBe("Message");
  failNextNotice();
  expect(() => new Notice("Failed")).toThrow("Test notice failed");
  expect(registry.notices).toEqual(["Message"]);
  expect(recordedNotices()).toEqual(["Message"]);
  clearNotices();
  expect(recordedNotices()).toEqual([]);
});

it("installs Obsidian DOM helpers on the chosen window", () => {
  installDomExtensions(window);
  const root = document.createElement("div");
  const child = root.createDiv({ cls: ["present"], text: "old" });
  child.createSpan({ text: "child" });
  child.createEl("strong", { text: "emphasis" });
  child.addClass("added");
  child.removeClass("present");
  child.toggleClass("on", true);
  expect([...child.classList]).toEqual(["added", "on"]);
  child.setText("new");
  expect(child.textContent).toBe("new");
  root.empty();
  expect(root.childNodes).toHaveLength(0);
});

it("exposes the test language and desktop host flags", () => {
  expect(getLanguage()).toBe("de");
  setLanguage("en");
  expect(getLanguage()).toBe("en");
  expect(Platform.isDesktopApp).toBe(true);
  expect(Platform.isMobile).toBe(false);
  expect(apiVersion).toBe("1.15.1");
});

it.each([
  ["\\a//b\\", "a/b"],
  ["//", "/"],
  ["a/.././b", "a/.././b"],
  [" a\u00a0 /e\u0301 ", " a  /é "],
])("normalizes %s like Obsidian", (input, expected) => {
  expect(normalizePath(input)).toBe(expected);
});
