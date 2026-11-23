import { PROJECT_BACKLOG, PROJECT_USE_CASE } from "../../application/backlog";
import type { ProjectSearchPart, ProjectTemplatePart } from "../projects";
import type { ModuleScreens } from "../shell";

export const backlogScreens = {
  screens: {
    [PROJECT_BACKLOG]: () => import("./BacklogScreen.vue").then((module) => module.default),
    [PROJECT_USE_CASE]: () => import("./PbiScreen.vue").then((module) => module.default),
  },
  sections: {},
  projectSearch: [() => import("./search").then((module) => module.backlogSearchSource)],
  projectTemplates: [
    {
      template: "pbi",
      create: async (request) => (await import("./template")).backlogTemplate(request),
    },
  ],
} satisfies ModuleScreens<"backlog"> & ProjectSearchPart & ProjectTemplatePart;
