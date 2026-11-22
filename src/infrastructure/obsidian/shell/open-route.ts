import type { Workspace } from "obsidian";
import type { Route } from "../../../application/routes";
import { SHELL_VIEW_TYPE } from "./shell-view";

export async function openRoute(workspace: Workspace, route?: Route): Promise<void> {
  const existing = workspace.getLeavesOfType(SHELL_VIEW_TYPE)[0];
  const leaf = existing ?? workspace.getLeaf(true);
  if (!existing || route !== undefined) {
    await leaf.setViewState({ type: SHELL_VIEW_TYPE, active: true, state: { route } });
  }
  await workspace.revealLeaf(leaf);
}
