import { Effect } from "effect";
import type { SettingDefinitionItem } from "obsidian";
import type { IntegrationsCatalog } from "../../../application/integrations";
import { SettingsService } from "../../../application/shell";
import type { SettingsMirror } from "../shell";
import type { McpItemChoices } from "./mcp-items";

const sharingKeyPrefix = "mcpSharedItem:";

function itemId(key: string): string | undefined {
  return key.startsWith(sharingKeyPrefix) ? key.slice(sharingKeyPrefix.length) : undefined;
}

type SharingOptions = {
  readonly mirror: SettingsMirror;
  readonly messages: IntegrationsCatalog["settings"]["mcp"]["sharing"];
  readonly choices: () => McpItemChoices;
};

export function createMcpSharing({ mirror, messages, choices }: SharingOptions) {
  function definition(id: string, name: string): SettingDefinitionItem {
    return {
      name,
      desc: id,
      searchable: false,
      control: { key: sharingKeyPrefix + id, type: "toggle", disabled: !mirror.status.writable },
    };
  }

  return {
    definitions(): SettingDefinitionItem[] {
      const { state, items } = choices();
      const selected = mirror.current.mcpSharedItemIds ?? [];
      const ids = new Set(items.map(({ id }) => id));
      const stale = selected.filter((id) => !ids.has(id));
      const rows: SettingDefinitionItem[] = [{ name: messages.title, desc: messages.description }];
      if (state !== "ready") rows.push({ name: messages[state] });
      else if (items.length === 0 && stale.length === 0) rows.push({ name: messages.empty });
      return [
        ...rows,
        ...items.map(({ id, title }) => definition(id, title)),
        ...stale.map((id) => definition(id, messages.unavailableItem)),
      ];
    },
    controlValue(key: string): boolean | undefined {
      const id = itemId(key);
      if (!id) return undefined;
      return mirror.current.mcpSharedItemIds?.includes(id) ?? false;
    },
    change(key: string, value: unknown) {
      const id = itemId(key);
      if (!id || typeof value !== "boolean") return undefined;
      return Effect.gen(function* () {
        const settings = yield* SettingsService;
        const { mcpSharedItemIds = [] } = yield* settings.current;
        const selected = new Set(mcpSharedItemIds);
        if (value) {
          if (!choices().items.some((item) => item.id === id) || selected.has(id)) return;
          selected.add(id);
        } else if (!selected.delete(id)) return;
        yield* settings.update({ mcpSharedItemIds: [...selected] });
      });
    },
  };
}
