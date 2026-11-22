import { ItemView } from "obsidian";
import type { ViewStateResult, WorkspaceLeaf } from "obsidian";
import type { AppRuntime } from "../../../application/app-services";
import { PRODUCT_NAME } from "../../../application/shell";
import type { RouteLike } from "../../../application/shell";
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

export const SHELL_VIEW_TYPE = "product-engineering-view";

function savedRoute(state: unknown): unknown {
  return typeof state === "object" && state !== null && "route" in state ? state.route : undefined;
}

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
    return { ...super.getState(), route: this.#viewNavigation.current() };
  }

  override async setState(state: unknown, result: ViewStateResult): Promise<void> {
    await super.setState(state, result);
    const route = this.definition.decode(savedRoute(state));
    if (this.#restored) {
      this.#viewNavigation.navigate(route);
    } else {
      this.#restored = true;
      this.#viewNavigation.reset(route);
    }
  }

  protected override async onOpen(): Promise<void> {
    if (this.#close) return;

    let previousRoute = this.#viewNavigation.current();
    const releases = [
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
