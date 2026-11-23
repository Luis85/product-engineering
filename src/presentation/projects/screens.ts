import {
  PROJECTS,
  PROJECT_ADMINISTRATION,
  PROJECT_OVERVIEW,
  PROJECT_RECORD,
} from "../../application/projects";
import type { ModuleScreens } from "../shell";
import type { ProjectSearchLoader } from "./search-sources";
import type { ProjectTemplateFactory } from "./template-factories";

const workspace = () => import("./index").then((module) => module.workspaceScreen);
export async function projectFrame(
  loaders: readonly ProjectSearchLoader[] = [],
  templates: readonly ProjectTemplateFactory[] = [],
) {
  const [module, sources] = await Promise.all([
    import("./index"),
    Promise.all(loaders.map((load) => load())),
  ]);
  return module.workspaceFrame(sources, templates);
}

export const projectsScreens = {
  screens: {
    [PROJECTS]: workspace,
    [PROJECT_ADMINISTRATION]: workspace,
    [PROJECT_OVERVIEW]: workspace,
    [PROJECT_RECORD]: workspace,
  },
  sections: {},
} satisfies ModuleScreens<"projects">;
