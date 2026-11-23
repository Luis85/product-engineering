import { knowledgeKinds, PROJECT_KNOWLEDGE } from "../../application/knowledge";
import type { ProjectSearchPart, ProjectTemplatePart } from "../projects";
import type { ModuleScreens } from "../shell";

export const knowledgeScreens = {
  screens: {
    [PROJECT_KNOWLEDGE]: () => import("./index").then((module) => module.knowledgeScreen),
  },
  sections: {},
  projectSearch: [() => import("./index").then((module) => module.knowledgeSearchSource)],
  projectTemplates: knowledgeKinds.map((template) => ({
    template,
    create: async (request) => (await import("./index")).createFromProjectTemplate(request),
  })),
} satisfies ModuleScreens<"knowledge"> & ProjectSearchPart & ProjectTemplatePart;
