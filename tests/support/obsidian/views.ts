import type {
  TFile,
  View as ObsidianView,
  ViewState,
  ViewStateResult,
  WorkspaceLeaf as ObsidianLeaf,
} from "obsidian";
import { Component } from "./component";
import type { Workspace } from "./workspace";

export type ViewFactory = (leaf: ObsidianLeaf) => View | ObsidianView;

export class View
  extends Component
  implements
    Pick<
      ObsidianView,
      "containerEl" | "navigation" | "getViewType" | "getDisplayText" | "getState" | "setState"
    >
{
  readonly leaf: WorkspaceLeaf;
  readonly containerEl: HTMLElement;
  readonly contentEl: HTMLElement;
  navigation = false;
  #state: Record<string, unknown> = {};

  constructor(leaf: WorkspaceLeaf | ObsidianLeaf) {
    super();
    if (!(leaf instanceof WorkspaceLeaf)) throw new Error("Expected a test workspace leaf");
    this.leaf = leaf;
    this.containerEl = leaf.containerEl.ownerDocument.createElement("div");
    this.contentEl = leaf.containerEl.ownerDocument.createElement("div");
    this.containerEl.append(this.contentEl);
    leaf.containerEl.append(this.containerEl);
  }

  getViewType(): string {
    return "empty";
  }

  getDisplayText(): string {
    return this.getViewType();
  }

  getState(): Record<string, unknown> {
    return this.#state;
  }

  setState(state: unknown, result: ViewStateResult): Promise<void>;
  setState(state: unknown): Promise<void> {
    if (typeof state === "object" && state !== null && !Array.isArray(state)) {
      this.#state = { ...state };
    }
    return Promise.resolve();
  }

  protected onOpen(): Promise<void> {
    return Promise.resolve();
  }

  protected onClose(): Promise<void> {
    return Promise.resolve();
  }

  async open(): Promise<void> {
    await this.load();
    await this.onOpen();
  }

  async close(): Promise<void> {
    try {
      await this.onClose();
    } finally {
      this.unload();
      this.containerEl.remove();
    }
  }
}

export class ItemView extends View {}

export class WorkspaceLeaf implements Pick<ObsidianLeaf, "setViewState" | "openFile"> {
  readonly containerEl: HTMLElement;
  readonly openedFiles: Pick<TFile, "path">[] = [];
  view: View | undefined;

  constructor(readonly workspace: Workspace) {
    this.containerEl = workspace.document.createElement("div");
    workspace.document.body.append(this.containerEl);
  }

  openIn(document: Document): void {
    document.body.append(document.adoptNode(this.containerEl));
  }

  async setViewState({ type, state = {} }: ViewState): Promise<void> {
    if (this.view?.getViewType() !== type) {
      const factory = this.workspace.viewFactories.get(type);
      if (!factory) throw new Error(`No test view registered for ${type}`);
      await this.view?.close();
      // The fake executes the real plugin's factory with a leaf from this partial host.
      const view = factory(this as unknown as ObsidianLeaf);
      if (!(view instanceof View)) throw new Error("Expected a test view");
      this.view = view;
      await view.open();
    }
    await this.view.setState(state, { history: false });
  }

  openFile(file: Pick<TFile, "path">): Promise<void> {
    this.openedFiles.push(file);
    return Promise.resolve();
  }

  // Tests await the close hook before reading the remaining leaves.
  async detach(): Promise<void> {
    const view = this.view;
    this.view = undefined;
    try {
      await view?.close();
    } finally {
      this.workspace.removeLeaf(this);
      this.containerEl.remove();
    }
  }
}
