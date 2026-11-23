import { APP_MODULES } from "../application/modules";
import type { AppModuleName } from "../application/modules";
import { appRoutes, SETTINGS_SECTIONS } from "../application/routes";
import type { Route } from "../application/routes";
import { SETTINGS } from "../application/shell";
import { backlogScreens } from "./backlog/screens";
import { domainModelScreens } from "./domain-model/screens";
import { gitScreens } from "./git/screens";
import { integrationsScreens } from "./integrations/screens";
import { itemsScreens } from "./items/screens";
import { knowledgeScreens } from "./knowledge/screens";
import { notesScreens } from "./notes/screens";
import { projectFrame, projectsScreens } from "./projects/screens";
import type { ProjectRecordPart, ProjectSearchPart, ProjectTemplatePart } from "./projects";
import type { ModuleScreens, SurfaceDefinition, SurfaceSection } from "./shell/host";
import type { ScreenLoader, SettingsSectionPart } from "./shell/host";
import { shellScreens } from "./shell/screens";

const MODULE_SCREENS: {
  readonly [Name in AppModuleName]: ModuleScreens<Name> &
    ProjectSearchPart &
    ProjectTemplatePart &
    ProjectRecordPart;
} = {
  shell: shellScreens,
  notes: notesScreens,
  items: itemsScreens,
  integrations: integrationsScreens,
  projects: projectsScreens,
  knowledge: knowledgeScreens,
  "domain-model": domainModelScreens,
  git: gitScreens,
  backlog: backlogScreens,
};

const modules = APP_MODULES.map(({ name }) => MODULE_SCREENS[name]);
const screens = Object.fromEntries<ScreenLoader>(
  modules.flatMap((module) => Object.entries<ScreenLoader>(module.screens)),
);
const sectionParts = Object.fromEntries<SettingsSectionPart>(
  modules.flatMap((module) => Object.entries<SettingsSectionPart>(module.sections)),
);
const sections = SETTINGS_SECTIONS.flatMap((id): SurfaceSection<Route>[] => {
  const part = sectionParts[id];
  return part ? [{ ...part, id, route: { name: SETTINGS, section: id } }] : [];
});
const context = modules.find((module) => module.context)?.context;
const projectSearch = modules.flatMap((module) => module.projectSearch ?? []);
const projectTemplates = modules.flatMap((module) => module.projectTemplates ?? []);
const projectRecords = modules.reduce<NonNullable<ProjectRecordPart["projectRecords"]>>(
  (records, module) => ({ ...records, ...module.projectRecords }),
  {},
);

export const appSurface: SurfaceDefinition<Route> = {
  ...appRoutes,
  frame: () => projectFrame(projectSearch, projectTemplates, projectRecords),
  screen: (route) => screens[route.name],
  sections,
  menu: modules.flatMap((module) => module.menu ?? []),
  ...(context ? { context } : {}),
};
