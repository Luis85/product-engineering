import { defineComponent, h } from "vue";
import type { Component } from "vue";
import ProjectFrame from "./components/ProjectFrame.vue";
import ProjectWorkspace from "./components/ProjectWorkspace.vue";
import type { ProjectSearchSource } from "./search-sources";
import type { ProjectTemplateFactory } from "./template-factories";

export { useRestoreWorkspacePosition } from "./workspace-position";
export { leafModalUi } from "./overlay-ui";
export type { ProjectSearchPart } from "./search-sources";
export type {
  ProjectTemplateFactory,
  ProjectTemplatePart,
  ProjectTemplateRequest,
} from "./template-factories";
export const workspaceScreen: Component = ProjectWorkspace;

export function workspaceFrame(
  sources: readonly ProjectSearchSource[],
  templates: readonly ProjectTemplateFactory[],
): Component {
  return defineComponent({
    name: "WorkspaceFrame",
    setup: () => () => h(ProjectFrame, { sources, templates }),
  });
}
