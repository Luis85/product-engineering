import type { Plugin } from "obsidian";
import { appServicesLayer } from "../../application/app-services-layer";
import type { AppAdapters, AppServiceOptions } from "../../application/app-services-layer";
import { artifactGitLayer } from "./git";
import { projectFilesLayer } from "./projects";
import { notesAdapters } from "./notes";
import { shellAdapters } from "./shell";

export function appLayer(
  plugin: Plugin,
  options: AppServiceOptions,
  agentChat?: AppAdapters["agentChat"],
  projectIntegrationHost?: AppAdapters["projectIntegrationHost"],
) {
  return appServicesLayer(
    {
      ...shellAdapters(plugin),
      ...notesAdapters(plugin),
      artifactGit: artifactGitLayer(plugin.app.vault),
      projectFiles: projectFilesLayer(
        plugin.app.vault,
        plugin.app.workspace,
        plugin.app.metadataCache,
      ),
      ...(agentChat ? { agentChat } : {}),
      ...(projectIntegrationHost ? { projectIntegrationHost } : {}),
    },
    options,
  );
}
