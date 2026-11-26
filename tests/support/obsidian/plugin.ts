import type {
  App as ObsidianApp,
  Command,
  Plugin as ObsidianPlugin,
  PluginManifest,
  PluginSettingTab as ObsidianSettingTab,
} from "obsidian";
import { App } from "./app";
import { Component } from "./component";
import { recordedNotices } from "./notice";
import type { PluginSettingTab } from "./settings";
import type { ViewFactory } from "./views";

export const TEST_MANIFEST = {
  id: "product-engineering",
  name: "Product Engineering",
  author: "Luis Mendez",
  version: "0.1.0",
  minAppVersion: "1.15.1",
  description: "Manage product engineering records in your vault.",
  isDesktopOnly: true,
} satisfies PluginManifest;

type SettingTab = ObsidianSettingTab | PluginSettingTab;
type CommandFailure = "before" | "after";

function copyData(data: unknown): unknown {
  const text = JSON.stringify(data);
  return text === undefined ? null : (JSON.parse(text) as unknown);
}

class Registry {
  readonly commands = new Map<string, Command>();
  readonly settingTabs: SettingTab[] = [];
  readonly saved: unknown[] = [];
  #data: unknown = null;
  #failLoadData = false;
  #loadGate: Promise<void> | undefined;
  #releaseLoad: (() => void) | undefined;
  #commandFailure: CommandFailure | undefined;

  constructor(readonly plugin: Plugin) {}

  get views(): Map<string, ViewFactory> {
    return this.plugin.app.workspace.viewFactories;
  }

  get ribbonIcons() {
    return this.plugin.app.workspace.leftRibbon.activeItems;
  }

  get notices(): readonly string[] {
    return recordedNotices();
  }

  load(): Promise<void> {
    return this.plugin.load();
  }

  runCommand(id: string): unknown {
    return this.commands.get(id)?.callback?.();
  }

  failNextAddCommand({ after = false }: { after?: boolean } = {}): void {
    this.#commandFailure = after ? "after" : "before";
  }

  takeCommandFailure(): CommandFailure | undefined {
    const failure = this.#commandFailure;
    this.#commandFailure = undefined;
    return failure;
  }

  setFailLoadData(fail = true): void {
    this.#failLoadData = fail;
  }

  holdLoadData(): void {
    this.#loadGate ??= new Promise<void>((resolve) => {
      this.#releaseLoad = resolve;
    });
  }

  releaseLoadData(): void {
    this.#releaseLoad?.();
    this.#loadGate = undefined;
    this.#releaseLoad = undefined;
  }

  seed(data: unknown): void {
    this.#data = copyData(data);
  }

  async readData(): Promise<unknown> {
    await this.#loadGate;
    if (this.#failLoadData) throw new Error("Test loadData failed");
    return copyData(this.#data);
  }

  save(data: unknown): void {
    this.seed(data);
    this.saved.push(copyData(this.#data));
  }

  async writeExternally(data: unknown): Promise<void> {
    this.seed(data);
    await this.plugin.onExternalSettingsChange();
  }
}

export class Plugin
  extends Component
  implements
    Pick<
      ObsidianPlugin,
      | "manifest"
      | "loadData"
      | "saveData"
      | "addCommand"
      | "removeCommand"
      | "addRibbonIcon"
      | "addSettingTab"
      | "registerView"
      | "onExternalSettingsChange"
    >
{
  readonly app: App;
  readonly testRegistry = new Registry(this);

  constructor(
    app: App | ObsidianApp,
    readonly manifest: PluginManifest,
  ) {
    super();
    if (!(app instanceof App)) throw new Error("Expected a test Obsidian app");
    this.app = app;
  }

  loadData(): Promise<unknown> {
    return this.testRegistry.readData();
  }

  saveData(data: unknown): Promise<void> {
    this.testRegistry.save(data);
    return Promise.resolve();
  }

  onExternalSettingsChange(): void | Promise<void> {
    return undefined;
  }

  addCommand(command: Command): Command {
    const failure = this.testRegistry.takeCommandFailure();
    if (failure === "before") throw new Error("Test addCommand failed before registration");

    const id = `${this.manifest.id}:${command.id}`;
    const item = { ...command, id, name: `${this.manifest.name}: ${command.name}` };
    const { commands } = this.testRegistry;
    commands.set(id, item);
    this.register(() => {
      if (commands.get(id) === item) commands.delete(id);
    });

    if (failure === "after") throw new Error("Test addCommand failed after registration");
    return item;
  }

  removeCommand(id: string): void {
    this.testRegistry.commands.delete(`${this.manifest.id}:${id}`);
  }

  addRibbonIcon(
    icon: string,
    title: string,
    callback: (event: MouseEvent) => unknown,
  ): HTMLElement {
    const ribbon = this.app.workspace.leftRibbon;
    const { buttonEl, release } = ribbon.add(`${this.manifest.id}:${title}`, icon, title, callback);
    this.register(release);
    return buttonEl;
  }

  addSettingTab(tab: SettingTab): void {
    const { settingTabs } = this.testRegistry;
    settingTabs.push(tab);
    this.register(() => {
      const index = settingTabs.indexOf(tab);
      if (index >= 0) settingTabs.splice(index, 1);
    });
  }

  registerView(type: string, factory: ViewFactory): void {
    const { views } = this.testRegistry;
    views.set(type, factory);
    this.register(() => {
      if (views.get(type) === factory) views.delete(type);
    });
  }
}

type TestPluginOptions = {
  readonly app?: App;
  readonly manifest?: PluginManifest;
  readonly data?: unknown;
  readonly layoutReady?: boolean;
  readonly document?: Document;
};

export function createTestPlugin<P extends Pick<ObsidianPlugin, "load" | "unload">>(
  PluginClass: new (app: ObsidianApp, manifest: PluginManifest) => P,
  options: TestPluginOptions = {},
): { plugin: P; registry: Registry } {
  const app = options.app ?? new App(options);
  // A real plugin is typed against the entire Obsidian App, including services this double omits.
  const plugin = new PluginClass(app as unknown as ObsidianApp, options.manifest ?? TEST_MANIFEST);
  if (!(plugin instanceof Plugin)) throw new Error("The test plugin must use the Obsidian double");
  plugin.testRegistry.seed(options.data);
  return { plugin, registry: plugin.testRegistry };
}
