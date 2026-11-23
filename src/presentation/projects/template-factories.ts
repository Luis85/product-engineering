import { inject, provide } from "vue";
import type { Component, InjectionKey } from "vue";
import type {
  ProjectAdministrationRoute,
  ProjectId,
  ProjectTemplateId,
} from "../../application/projects";

export type ProjectTemplateRequest = {
  readonly projectId: ProjectId;
  readonly template: ProjectTemplateId;
  readonly returnTo: ProjectAdministrationRoute;
  readonly dismiss: () => void;
};

export type ProjectTemplateFactory = {
  readonly template: ProjectTemplateId;
  readonly create: (request: ProjectTemplateRequest) => Component | Promise<Component>;
};

export type ProjectTemplatePart = { readonly projectTemplates?: readonly ProjectTemplateFactory[] };
const factoriesKey: InjectionKey<readonly ProjectTemplateFactory[]> = Symbol(
  "project-template-factories",
);

export function provideProjectTemplateFactories(factories: readonly ProjectTemplateFactory[]) {
  provide(factoriesKey, factories);
}

export function useProjectTemplateFactories() {
  return inject(factoriesKey, []);
}
