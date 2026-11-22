function configureElement(element: HTMLElement, options: DomElementInfo): void {
  const classes =
    typeof options.cls === "string" ? options.cls.split(/\s+/).filter(Boolean) : options.cls;
  if (classes) element.classList.add(...classes);
  if (options.text !== undefined) element.append(options.text);
  const attributes = {
    title: options.title,
    value: options.value,
    type: options.type,
    ...options.attr,
  };
  for (const [name, value] of Object.entries(attributes)) {
    if (value !== null && value !== undefined) element.setAttribute(name, String(value));
  }
}

function createEl<K extends keyof HTMLElementTagNameMap>(
  this: HTMLElement | DocumentFragment,
  tag: K,
  options: DomElementInfo | string = {},
  callback?: (element: HTMLElementTagNameMap[K]) => void,
): HTMLElementTagNameMap[K] {
  const config = typeof options === "string" ? { cls: options } : options;
  const parent = config.parent ?? this;
  const element = this.ownerDocument.createElement(tag);
  configureElement(element, config);
  parent.insertBefore(element, config.prepend ? parent.firstChild : null);
  callback?.(element);
  return element;
}

function createDiv(
  this: HTMLElement | DocumentFragment,
  options?: DomElementInfo | string,
  callback?: (element: HTMLDivElement) => void,
) {
  return this.createEl("div", options, callback);
}

const methods = {
  createEl,
  createDiv,
  createSpan(
    this: HTMLElement,
    options?: DomElementInfo | string,
    callback?: (element: HTMLSpanElement) => void,
  ) {
    return this.createEl("span", options, callback);
  },
  empty(this: HTMLElement) {
    this.replaceChildren();
  },
  setText(this: HTMLElement, text: string | DocumentFragment) {
    this.replaceChildren(text);
  },
  addClass(this: HTMLElement, ...classes: string[]) {
    this.classList.add(...classes);
  },
  removeClass(this: HTMLElement, ...classes: string[]) {
    this.classList.remove(...classes);
  },
  toggleClass(this: HTMLElement, name: string, value: boolean) {
    this.classList.toggle(name, value);
  },
};

export function installDomExtensions(
  window: Pick<typeof globalThis, "HTMLElement" | "DocumentFragment">,
): void {
  const prototypes = [
    [window.HTMLElement.prototype, methods],
    [window.DocumentFragment.prototype, { createEl, createDiv }],
  ] as const;
  for (const [prototype, extensions] of prototypes) {
    for (const [name, value] of Object.entries(extensions)) {
      Object.defineProperty(prototype, name, { value, configurable: true, writable: true });
    }
  }
}
