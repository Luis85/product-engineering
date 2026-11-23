import { Effect, Layer } from "effect";
import type { Plugin } from "obsidian";
import type { ProjectMcpProbe } from "../../../application/integrations";
import { ProjectIntegrationError, ProjectIntegrationHost } from "../../../application/projects";
import type { ProjectId } from "../../../application/projects";

type SettingsHost = { readonly setting?: { open(): void; openTabById(id: string): unknown } };

export function projectIntegrationSettingsLayer(
  plugin: Plugin,
  probe: (id: ProjectId, signal: AbortSignal) => Promise<ProjectMcpProbe>,
) {
  return Layer.succeed(ProjectIntegrationHost, {
    probe: (projectId) => Effect.promise((signal) => probe(projectId, signal)),
    openSettings: Effect.try({
      try: () => {
        const { setting } = plugin.app as typeof plugin.app & SettingsHost;
        if (!setting) throw new Error("Obsidian settings are unavailable");
        setting.open();
        setting.openTabById(plugin.manifest.id);
      },
      catch: () => new ProjectIntegrationError({ reason: "settings" }),
    }),
  });
}
