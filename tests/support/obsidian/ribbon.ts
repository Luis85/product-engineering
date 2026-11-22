type RibbonItem = {
  readonly id: string;
  readonly title: string;
  readonly icon: string;
  readonly element: HTMLElement;
};

export class Ribbon {
  readonly items = new Map<string, RibbonItem>();
  readonly #container: HTMLElement;

  constructor(readonly document: Document) {
    this.#container = document.createElement("div");
    this.#container.className = "workspace-ribbon";
  }

  add(
    id: string,
    icon: string,
    title: string,
    callback: (event: MouseEvent) => unknown,
  ): RibbonItem {
    this.items.get(id)?.element.remove();
    const element = this.document.createElement("button");
    element.type = "button";
    element.setAttribute("aria-label", title);
    element.addEventListener("click", (event) => {
      callback(event);
    });
    const item = { id, title, icon, element };
    this.items.set(id, item);
    this.onChange();
    return item;
  }

  remove(item: RibbonItem): void {
    item.element.remove();
    if (this.items.get(item.id) === item) this.items.delete(item.id);
  }

  onChange(): void {
    for (const { element } of this.items.values()) {
      if (element.parentElement !== this.#container) this.#container.append(element);
    }
    if (!this.#container.isConnected && this.items.size > 0)
      this.document.body.append(this.#container);
  }
}
