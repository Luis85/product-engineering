import type { Plugin } from "obsidian";
import { appServicesLayer } from "../../application/app-services-layer";
import type { AppAdapters, AppServiceOptions } from "../../application/app-services-layer";
import { shellAdapters } from "./shell";

export function appLayer(
  plugin: Plugin,
  options: AppServiceOptions,
  agentChat?: AppAdapters["agentChat"],
) {
  return appServicesLayer(
    { ...shellAdapters(plugin), ...(agentChat ? { agentChat } : {}) },
    options,
  );
}
