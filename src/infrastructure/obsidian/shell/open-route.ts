import type { Workspace } from "obsidian";
import type { Route } from "../../../application/routes";
import { SHELL_VIEW_TYPE } from "./shell-view";

export async function openRoute(
  workspace: Workspace,
  route?: Route,
  signal?: string,
): Promise<void> {
  const recent = workspace.getMostRecentLeaf();
  const existing =
    recent?.view.getViewType() === SHELL_VIEW_TYPE
      ? recent
      : workspace.getLeavesOfType(SHELL_VIEW_TYPE)[0];
  const leaf = existing ?? workspace.getLeaf(true);
  if (!existing || route !== undefined || signal) {
    const previous = existing?.view.getState().route;
    await leaf.setViewState({
      type: SHELL_VIEW_TYPE,
      active: true,
      state: { route: route ?? previous, ...(signal && { signal }) },
    });
  }
  await workspace.revealLeaf(leaf);
}
