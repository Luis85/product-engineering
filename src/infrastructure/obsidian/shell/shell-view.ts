import { ItemView } from "obsidian";
import type { Workspace } from "obsidian";
import { PRODUCT_NAME } from "../../../application/shell";

export const SHELL_VIEW_TYPE = "product-engineering-view";

export class ShellView extends ItemView {
  getViewType(): string {
    return SHELL_VIEW_TYPE;
  }

  getDisplayText(): string {
    return PRODUCT_NAME;
  }
}

export async function openShellView(workspace: Workspace): Promise<void> {
  const existing = workspace.getLeavesOfType(SHELL_VIEW_TYPE)[0];
  if (existing) {
    await workspace.revealLeaf(existing);
    return;
  }

  const leaf = workspace.getLeaf("tab");
  await leaf.setViewState({ type: SHELL_VIEW_TYPE });
  await workspace.revealLeaf(leaf);
}
