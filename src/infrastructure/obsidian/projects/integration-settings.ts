import { Effect, Layer } from "effect";
import type { Plugin } from "obsidian";
import type { IntegrationsCatalog, ProjectMcpProbe } from "../../../application/integrations";
import { ProjectIntegrationError, ProjectIntegrationHost } from "../../../application/projects";
import type { ProjectId } from "../../../application/projects";

type SettingsHost = {
  readonly setting?: {
    open(): void;
    openTabById(id: string): { readonly containerEl: HTMLElement } | undefined;
  };
};

function focusSetting(container: HTMLElement, name: string): void {
  const label = [...container.querySelectorAll(".setting-item-name")].find(
    (candidate) => candidate.textContent === name,
  );
  label?.closest(".setting-item")?.querySelector<HTMLInputElement>("input")?.focus();
}

export function projectIntegrationSettingsLayer(
  plugin: Plugin,
  probe: (id: ProjectId, signal: AbortSignal) => Promise<ProjectMcpProbe>,
  ai: IntegrationsCatalog["settings"]["ai"],
) {
  return Layer.succeed(ProjectIntegrationHost, {
    probe: (projectId) => Effect.promise((signal) => probe(projectId, signal)),
    openSettings: (provider) =>
      Effect.try({
        try: () => {
          const { setting } = plugin.app as typeof plugin.app & SettingsHost;
          if (!setting) throw new Error("Obsidian settings are unavailable");
          setting.open();
          const tab = setting.openTabById(plugin.manifest.id);
          if (!tab) throw new Error("Product Engineering settings are unavailable");
          if (provider)
            focusSetting(
              tab.containerEl,
              provider === "codex" ? ai.codexPath.name : ai.claudeCodePath.name,
            );
        },
        catch: () => new ProjectIntegrationError({ reason: "settings" }),
      }),
  });
}
