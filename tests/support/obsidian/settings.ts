import type {
  App as ObsidianApp,
  DropdownComponent as ObsidianDropdown,
  Plugin as ObsidianPlugin,
  PluginSettingTab as ObsidianSettingTab,
  Setting as ObsidianSetting,
  SettingControl,
  SettingDefinitionItem,
  TextComponent as ObsidianText,
  ToggleComponent as ObsidianToggle,
} from "obsidian";
import { App } from "./app";
import type { Plugin } from "./plugin";

// Fluent host methods return the full host class. The double checks their input
// types and returns its own smaller class.
type HostShape<Api, Key extends keyof Api> = {
  [Name in Key]: Api[Name] extends (...args: infer Args) => unknown
    ? (...args: Args) => unknown
    : Api[Name];
};

abstract class ValueControl<Value, Element extends HTMLInputElement | HTMLSelectElement> {
  #change: ((value: Value) => unknown) | undefined;
  pending = Promise.resolve();

  protected constructor(
    protected readonly element: Element,
    parent: HTMLElement,
    event: string,
  ) {
    parent.append(element);
    element.addEventListener(event, () => {
      const value = this.getValue();
      this.pending = Promise.resolve()
        .then(() => this.#change?.(value))
        .then(() => undefined);
    });
  }

  abstract getValue(): Value;

  setDisabled(disabled: boolean): this {
    this.element.disabled = disabled;
    return this;
  }

  onChange(callback: (value: Value) => unknown): this {
    this.#change = callback;
    return this;
  }
}

export class TextComponent
  extends ValueControl<string, HTMLInputElement>
  implements
    HostShape<ObsidianText, "inputEl" | "getValue" | "setValue" | "onChange" | "setDisabled">
{
  constructor(parent: HTMLElement) {
    super(parent.ownerDocument.createElement("input"), parent, "input");
  }

  get inputEl(): HTMLInputElement {
    return this.element;
  }

  getValue(): string {
    return this.element.value;
  }

  setValue(value: string): this {
    this.element.value = value;
    return this;
  }
}

export class ToggleComponent
  extends ValueControl<boolean, HTMLInputElement>
  implements
    HostShape<ObsidianToggle, "toggleEl" | "getValue" | "setValue" | "onChange" | "setDisabled">
{
  constructor(parent: HTMLElement) {
    const input = parent.ownerDocument.createElement("input");
    input.type = "checkbox";
    super(input, parent, "change");
  }

  get toggleEl(): HTMLElement {
    return this.element;
  }

  getValue(): boolean {
    return this.element.checked;
  }

  setValue(value: boolean): this {
    this.element.checked = value;
    return this;
  }
}

export class DropdownComponent
  extends ValueControl<string, HTMLSelectElement>
  implements
    HostShape<
      ObsidianDropdown,
      "selectEl" | "addOptions" | "addOption" | "getValue" | "setValue" | "onChange" | "setDisabled"
    >
{
  constructor(parent: HTMLElement) {
    super(parent.ownerDocument.createElement("select"), parent, "change");
  }

  get selectEl(): HTMLSelectElement {
    return this.element;
  }

  addOption(value: string, text: string): this {
    const option = this.element.ownerDocument.createElement("option");
    option.value = value;
    option.text = text;
    this.element.append(option);
    return this;
  }

  addOptions(options: Record<string, string>): this {
    for (const [value, text] of Object.entries(options)) this.addOption(value, text);
    return this;
  }

  getValue(): string {
    return this.element.value;
  }

  setValue(value: string): this {
    this.element.value = value;
    return this;
  }
}

export class Setting implements HostShape<
  ObsidianSetting,
  "settingEl" | "nameEl" | "descEl" | "controlEl" | "setName" | "setDesc"
> {
  readonly settingEl: HTMLElement;
  readonly nameEl: HTMLElement;
  readonly descEl: HTMLElement;
  readonly controlEl: HTMLElement;

  constructor(parent: HTMLElement) {
    const owner = parent.ownerDocument;
    this.settingEl = owner.createElement("div");
    this.nameEl = owner.createElement("div");
    this.descEl = owner.createElement("div");
    this.controlEl = owner.createElement("div");
    this.settingEl.append(this.nameEl, this.descEl, this.controlEl);
    parent.append(this.settingEl);
  }

  setName(name: string | DocumentFragment): this {
    this.nameEl.replaceChildren(name);
    return this;
  }

  setDesc(description: string | DocumentFragment): this {
    this.descEl.replaceChildren(description);
    return this;
  }
}

type SupportedControl = Extract<SettingControl, { type: "text" | "toggle" | "dropdown" }>;
type RenderedSetting = {
  readonly setting: Setting;
  readonly control: TextComponent | ToggleComponent | DropdownComponent;
};

function supported(control: SettingControl): control is SupportedControl {
  return control.type === "text" || control.type === "toggle" || control.type === "dropdown";
}

function flag(value: boolean | (() => boolean) | undefined, fallback: boolean): boolean {
  return typeof value === "function" ? value() : (value ?? fallback);
}

function renderControl(
  control: SupportedControl,
  parent: HTMLElement,
  value: unknown,
): RenderedSetting["control"] {
  switch (control.type) {
    case "text":
      return new TextComponent(parent).setValue(typeof value === "string" ? value : "");
    case "toggle":
      return new ToggleComponent(parent).setValue(value === true);
    case "dropdown":
      return new DropdownComponent(parent)
        .addOptions(control.options)
        .setValue(typeof value === "string" ? value : "");
  }
}

export class PluginSettingTab implements Pick<
  ObsidianSettingTab,
  "containerEl" | "getSettingDefinitions" | "getControlValue" | "setControlValue" | "update"
> {
  readonly containerEl: HTMLElement;
  readonly app: App;
  readonly renderedSettings = new Map<string, RenderedSetting>();

  constructor(
    app: App | ObsidianApp,
    readonly plugin: Plugin | ObsidianPlugin,
  ) {
    if (!(app instanceof App)) throw new Error("Expected a test Obsidian app");
    this.app = app;
    this.containerEl = app.workspace.document.createElement("div");
  }

  getSettingDefinitions(): SettingDefinitionItem[] {
    return [];
  }

  #settingsData(): Record<string, unknown> | undefined {
    if (!("settings" in this.plugin)) return;
    const { settings } = this.plugin;
    if (settings && typeof settings === "object" && !Array.isArray(settings)) {
      return settings as Record<string, unknown>;
    }
  }

  getControlValue(key: string): unknown {
    return this.#settingsData()?.[key];
  }

  setControlValue(key: string, value: unknown): void | Promise<void> {
    const settings = this.#settingsData();
    if (!settings) return;
    settings[key] = value;
    return this.plugin.saveData(settings);
  }

  update(): void {
    this.containerEl.replaceChildren();
    this.renderedSettings.clear();
    for (const definition of this.getSettingDefinitions()) this.#render(definition);
  }

  #render(definition: SettingDefinitionItem): void {
    if ("type" in definition || !flag(definition.visible, true)) return;
    const { control } = definition;
    if (control && !supported(control)) return;
    const setting = new Setting(this.containerEl).setName(definition.name);
    if (definition.desc !== undefined) setting.setDesc(definition.desc);
    if (!control) return;
    const value = this.getControlValue(control.key) ?? control.defaultValue;
    const widget = renderControl(control, setting.controlEl, value);
    widget.setDisabled(flag(control.disabled, false));
    widget.onChange((next: string | boolean) => this.setControlValue(control.key, next));
    this.renderedSettings.set(control.key, { setting, control: widget });
  }
}

export function settingsIn(
  tab: PluginSettingTab | ObsidianSettingTab,
): ReadonlyMap<string, RenderedSetting> {
  if (!(tab instanceof PluginSettingTab)) throw new Error("Expected a test settings tab");
  return tab.renderedSettings;
}
