import { inject, provide } from "vue";
import type { InjectionKey } from "vue";
import type { Project } from "../../application/projects";
import type { Route } from "../../application/routes";

export type CopilotEntry = { readonly trigger: HTMLElement; readonly review?: boolean };
type OpenCopilot = (entry: CopilotEntry) => void;
type CopilotHost = {
  readonly open: OpenCopilot;
  readonly project: () => Project | undefined;
  readonly navigate: (route: Route) => boolean | Promise<boolean>;
  readonly followCitation: (route: Route) => Promise<boolean>;
};
const key: InjectionKey<CopilotHost> = Symbol("project-copilot");

export function provideCopilotEntry(host: CopilotHost) {
  provide(key, host);
}

export function useCopilotEntry() {
  return inject(key, undefined)?.open;
}

export function useCopilotProject() {
  return inject(key, undefined);
}
