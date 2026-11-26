import { knowledgeKinds, PROJECT_KNOWLEDGE } from "../../application/knowledge";
import type { ProjectRecordPart, ProjectSearchPart, ProjectTemplatePart } from "../projects";
import type { ModuleScreens } from "../shell";

export const knowledgeScreens = {
  screens: {
    [PROJECT_KNOWLEDGE]: () => import("./index").then((module) => module.knowledgeScreen),
  },
  sections: {},
  projectRecords: {
    knowledge: {
      section: PROJECT_KNOWLEDGE,
      load: () => import("./KnowledgeNoteScreen.vue").then((module) => module.default),
    },
  },
  projectSearch: [() => import("./index").then((module) => module.knowledgeSearchSource)],
  projectTemplates: knowledgeKinds.map((template) => ({
    template,
    create: async (request) => (await import("./index")).createFromProjectTemplate(request),
  })),
} satisfies ModuleScreens<"knowledge"> &
  ProjectSearchPart &
  ProjectTemplatePart &
  ProjectRecordPart;
