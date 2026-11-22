type RibbonItem = {
  readonly id: string;
  title: string;
  icon: string;
  hidden: boolean;
  callback?: (event: MouseEvent) => unknown;
  buttonEl?: HTMLButtonElement;
};

export class Ribbon {
  readonly items = new Map<string, RibbonItem>();
  readonly #container: HTMLElement;

  constructor(readonly document: Document) {
    this.#container = document.createElement("div");
    this.#container.className = "workspace-ribbon";
  }

  get activeItems() {
    return new Map([...this.items].filter(([, item]) => item.callback !== undefined));
  }

  add(id: string, icon: string, title: string, callback: (event: MouseEvent) => unknown) {
    const item: RibbonItem = this.items.get(id) ?? { id, title, icon, hidden: false };
    item.buttonEl?.remove();
    const buttonEl = this.document.createElement("button");
    buttonEl.type = "button";
    buttonEl.setAttribute("aria-label", title);
    const click = (event: MouseEvent) => {
      callback(event);
    };
    buttonEl.addEventListener("click", click);
    item.title = title;
    item.icon = icon;
    item.callback = callback;
    item.buttonEl = buttonEl;
    this.items.set(id, item);
    this.onChange();
    return {
      buttonEl,
      release: () => {
        buttonEl.removeEventListener("click", click);
        buttonEl.remove();
        if (item.buttonEl !== buttonEl) return;
        delete item.callback;
        delete item.buttonEl;
      },
    };
  }

  onChange(): void {
    for (const { buttonEl, hidden } of this.items.values()) {
      if (!buttonEl) continue;
      if (hidden) buttonEl.remove();
      else if (buttonEl.parentElement !== this.#container) this.#container.append(buttonEl);
    }
    if (!this.#container.isConnected && this.#container.childElementCount > 0)
      this.document.body.append(this.#container);
  }
}
