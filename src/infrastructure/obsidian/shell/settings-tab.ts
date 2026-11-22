import { Effect } from "effect";
import { PluginSettingTab } from "obsidian";
import type { App, Plugin, SettingDefinitionItem } from "obsidian";
import type { AppRuntime } from "../../../application/app-services";
import { describeShellError, ISSUES_URL, Notifier, setLogLevel } from "../../../application/shell";
import type { ShellCatalog } from "../../../application/shell";
import { validatePatch } from "../../../domain/shell";
import { runSafely } from "./run";
import type { SettingsMirror } from "./settings-mirror";

export interface SettingsTabPart {
  readonly definitions: (refresh: () => void) => SettingDefinitionItem[];
  readonly getControlValue: (key: string) => unknown;
  readonly setControlValue: (key: string, value: unknown) => Promise<void>;
}

export class ShellSettingTab extends PluginSettingTab {
  constructor(
    app: App,
    plugin: Plugin,
    private readonly runtime: AppRuntime,
    private readonly mirror: SettingsMirror,
    private readonly messages: ShellCatalog,
    private readonly extra?: SettingsTabPart,
  ) {
    super(app, plugin);
  }

  override getSettingDefinitions(): SettingDefinitionItem[] {
    const { logLevel, issuesLink } = this.messages.settingsTab;
    const definitions: SettingDefinitionItem[] = [
      {
        name: logLevel.name,
        desc: logLevel.desc,
        control: {
          type: "dropdown",
          key: "logLevel",
          options: { ...logLevel.labels },
          disabled: !this.mirror.status.writable,
          validate: (value) => {
            const { issues } = validatePatch({ logLevel: value });
            return issues.length ? this.messages.settingsReset.detail(issues) : undefined;
          },
        },
      },
    ];

    const { readOnlyReason } = this.mirror.status;
    if (readOnlyReason) {
      const { title, detail } = this.messages.errors.readOnly;
      const desc = activeDocument.createDocumentFragment();
      desc.append(detail[readOnlyReason], " ");
      desc.createEl("a", {
        text: issuesLink,
        attr: { href: ISSUES_URL, target: "_blank", rel: "noopener" },
      });
      definitions.push({ name: title, desc });
    }
    if (this.extra) definitions.push(...this.extra.definitions(() => this.update()));
    return definitions;
  }

  override getControlValue(key: string): unknown {
    return key === "logLevel" ? this.mirror.current.logLevel : this.extra?.getControlValue(key);
  }

  override async setControlValue(key: string, value: unknown): Promise<void> {
    if (key !== "logLevel") {
      if (this.extra) {
        await this.extra.setControlValue(key, value);
        await runSafely(
          this.runtime,
          Effect.promise(() => this.mirror.refresh()).pipe(
            Effect.andThen(Effect.sync(() => this.update())),
          ),
        );
      }
      return;
    }

    const change = Effect.matchEffect(setLogLevel(value), {
      onSuccess: () => Effect.void,
      onFailure: (error) =>
        Effect.flatMap(Notifier, (notifier) =>
          notifier.notify(describeShellError(error, this.messages)),
        ),
    });
    await runSafely(
      this.runtime,
      change.pipe(
        Effect.andThen(Effect.promise(() => this.mirror.refresh())),
        Effect.andThen(Effect.sync(() => this.update())),
      ),
    );
  }
}
