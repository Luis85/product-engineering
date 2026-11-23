import { defineComponent, h } from "vue";
import type { Component } from "vue";
import ProjectFrame from "./components/ProjectFrame.vue";
import ProjectWorkspace from "./components/ProjectWorkspace.vue";
import type { ProjectSearchSource } from "./search-sources";

export type { ProjectSearchPart } from "./search-sources";
export const workspaceScreen: Component = ProjectWorkspace;

export function workspaceFrame(sources: readonly ProjectSearchSource[]): Component {
  return defineComponent({
    name: "WorkspaceFrame",
    setup: () => () => h(ProjectFrame, { sources }),
  });
}
