import type { PaneType, Workspace as ObsidianWorkspace } from "obsidian";
import { Events } from "./events";
import { Ribbon } from "./ribbon";
import { WorkspaceLeaf } from "./views";
import type { ViewFactory } from "./views";

export class Workspace
  extends Events
  implements Pick<ObsidianWorkspace, "layoutReady" | "onLayoutReady">
{
  readonly leftRibbon: Ribbon;
  readonly viewFactories = new Map<string, ViewFactory>();
  readonly leafRequests: (PaneType | boolean)[] = [];
  readonly revealedLeaves: WorkspaceLeaf[] = [];
  layoutSaves = 0;

  readonly #layoutCallbacks: (() => unknown)[] = [];
  readonly #leaves = new Set<WorkspaceLeaf>();

  constructor(
    readonly document: Document,
    public layoutReady = true,
  ) {
    super();
    this.leftRibbon = new Ribbon(document);
  }

  onLayoutReady(callback: () => unknown): void {
    if (this.layoutReady) callback();
    else this.#layoutCallbacks.push(callback);
  }

  markLayoutReady(): void {
    if (this.layoutReady) return;
    this.layoutReady = true;
    for (const callback of this.#layoutCallbacks.splice(0)) callback();
  }

  getLeaf(mode: PaneType | boolean = false): WorkspaceLeaf {
    this.leafRequests.push(mode);
    const leaf = new WorkspaceLeaf(this);
    this.#leaves.add(leaf);
    return leaf;
  }

  getLeavesOfType(type: string): WorkspaceLeaf[] {
    return [...this.#leaves].filter((leaf) => leaf.view?.getViewType() === type);
  }

  revealLeaf(leaf: WorkspaceLeaf): Promise<void> {
    this.revealedLeaves.push(leaf);
    return Promise.resolve();
  }

  requestSaveLayout(): void {
    this.layoutSaves += 1;
  }

  removeLeaf(leaf: WorkspaceLeaf): void {
    this.#leaves.delete(leaf);
  }
}
