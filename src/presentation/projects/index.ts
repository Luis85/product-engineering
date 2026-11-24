import { defineComponent, h } from "vue";
import type { Component } from "vue";
import ProjectFrame from "./components/ProjectFrame.vue";
import ProjectWorkspace from "./components/ProjectWorkspace.vue";
import { provideProjectRecordScreens } from "./record-screens";
import type { ProjectRecordScreens } from "./record-screens";
import type { ProjectSearchSource } from "./search-sources";
import type { ProjectTemplateFactory } from "./template-factories";

export {
  useRememberWorkspaceOrigin,
  useRestoreWorkspacePosition,
  useWorkspaceOriginKey,
  useWorkspaceRouteFocus,
} from "./workspace-position";
export { leafModalUi } from "./overlay-ui";
export type { ProjectRecordPart } from "./record-screens";
export type { ProjectSearchPart } from "./search-sources";
export { useProjectSearchSources } from "./search-sources";
export type {
  ProjectTemplateFactory,
  ProjectTemplatePart,
  ProjectTemplateRequest,
} from "./template-factories";
export const workspaceScreen: Component = ProjectWorkspace;

export function workspaceFrame(
  sources: readonly ProjectSearchSource[],
  templates: readonly ProjectTemplateFactory[],
  records: ProjectRecordScreens,
): Component {
  return defineComponent({
    name: "WorkspaceFrame",
    setup: () => {
      provideProjectRecordScreens(records);
      return () => h(ProjectFrame, { sources, templates });
    },
  });
}
