import { ItemView } from "obsidian";
import type { ViewStateResult, WorkspaceLeaf } from "obsidian";
import type { AppRuntime } from "../../../application/app-services";
import { PRODUCT_NAME } from "../../../application/shell";
import type { RouteLike } from "../../../application/shell";
import { isPlainRecord } from "../../../domain/shell";
import {
  loadSurface as importSurface,
  memoryNavigation,
  releaseAll,
} from "../../../presentation/shell/host";
import type {
  MemoryNavigation,
  SurfaceDefinition,
  SurfaceLoader,
} from "../../../presentation/shell/host";
import { markdownHost } from "./markdown-host";

export const SHELL_VIEW_TYPE = "product-engineering-view";

export class ShellView<R extends RouteLike> extends ItemView {
  override navigation = false;
  readonly #viewNavigation: MemoryNavigation<R>;
  #restored = false;
  #close: (() => void) | undefined;

  constructor(
    leaf: WorkspaceLeaf,
    private readonly runtime: AppRuntime,
    private readonly surfaces: Set<() => void>,
    private readonly definition: SurfaceDefinition<R>,
    private readonly loadSurface: SurfaceLoader = importSurface,
  ) {
    super(leaf);
    this.#viewNavigation = memoryNavigation(definition);
  }

  override getViewType(): string {
    return SHELL_VIEW_TYPE;
  }

  override getDisplayText(): string {
    return PRODUCT_NAME;
  }

  override getIcon(): string {
    return "settings";
  }

  override getState(): Record<string, unknown> {
    const { signal: _signal, collapsedRail: _rail, ...state } = super.getState();
    return {
      ...state,
      route: this.#viewNavigation.current(),
      ...(this.#viewNavigation.railCollapsed() && { collapsedRail: true }),
    };
  }

  override async setState(state: unknown, result: ViewStateResult): Promise<void> {
    await super.setState(state, result);
    const saved = isPlainRecord(state) ? state : {};
    const route = this.definition.decode(saved.route);
    if (this.#restored) {
      await this.#viewNavigation.navigate(route);
    } else {
      this.#restored = true;
      this.#viewNavigation.reset(route);
      this.#viewNavigation.setRailCollapsed(saved.collapsedRail === true);
    }
    if (typeof saved.signal === "string") this.#viewNavigation.sendSignal(saved.signal);
  }

  protected override async onOpen(): Promise<void> {
    if (this.#close) return;

    this.containerEl.querySelector<HTMLElement>(":scope > .view-header")?.hide();

    let previousRoute = this.#viewNavigation.current();
    const releases = [
      this.#viewNavigation.onRailChange(() => this.app.workspace.requestSaveLayout()),
      this.#viewNavigation.onChange((route) => {
        if (this.definition.equals(route, previousRoute)) return;
        previousRoute = route;
        this.app.workspace.requestSaveLayout();
      }),
    ];
    const close = () => {
      if (this.#close !== close) return;
      this.#close = undefined;
      this.surfaces.delete(close);
      releaseAll(releases);
    };
    this.#close = close;
    this.surfaces.add(close);

    let unmount: () => void;
    try {
      const { mountSurface } = await this.loadSurface();
      if (this.#close !== close) return;

      this.contentEl.empty();
      unmount = await mountSurface(this.contentEl, this.runtime, {
        surface: this.definition,
        navigation: this.#viewNavigation,
        markdownHost: markdownHost(this.app),
      });
    } catch (cause) {
      if (this.#close !== close) return;
      close();
      throw cause;
    }

    if (this.#close === close) releases.push(unmount);
    else unmount();
  }

  protected override onClose(): Promise<void> {
    this.#close?.();
    return Promise.resolve();
  }
}
