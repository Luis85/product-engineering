import {
  PROJECTS,
  PROJECT_ADMINISTRATION,
  PROJECT_OVERVIEW,
  PROJECT_RECORD,
} from "../../application/projects";
import type { ModuleScreens } from "../shell";
import type { ProjectRecordScreens } from "./record-screens";
import type { ProjectSearchLoader } from "./search-sources";
import type { ProjectTemplateFactory } from "./template-factories";

const workspace = () =>
  import("./components/ProjectWorkspace.vue").then((module) => module.default);
export async function projectFrame(
  loaders: readonly ProjectSearchLoader[] = [],
  templates: readonly ProjectTemplateFactory[] = [],
  records: ProjectRecordScreens = {},
) {
  const [module, sources] = await Promise.all([
    import("./index"),
    Promise.all(loaders.map((load) => load())),
  ]);
  return module.workspaceFrame(sources, templates, records);
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
