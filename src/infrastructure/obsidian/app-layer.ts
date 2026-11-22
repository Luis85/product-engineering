import type { Plugin } from "obsidian";
import { appServicesLayer } from "../../application/app-services-layer";
import type { AppServiceOptions } from "../../application/app-services-layer";
import { shellAdapters } from "./shell";

export function appLayer(plugin: Plugin, options: AppServiceOptions) {
  return appServicesLayer(shellAdapters(plugin), options);
}
