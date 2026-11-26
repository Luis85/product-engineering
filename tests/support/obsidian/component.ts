import type { Component as ObsidianComponent, EventRef } from "obsidian";
import { releaseEvent } from "./events";

type Options = boolean | AddEventListenerOptions;
type DomListener<T> = (this: HTMLElement, event: T) => unknown;

export class Component implements Pick<
  ObsidianComponent,
  "unload" | "onunload" | "register" | "registerEvent" | "registerDomEvent" | "registerInterval"
> {
  #loaded = false;
  readonly #cleanups: (() => unknown)[] = [];

  // Tests await the bootstrap hook through this host double.
  async load(): Promise<void> {
    if (this.#loaded) return;
    this.#loaded = true;
    await this.onload();
  }

  onload(): void | Promise<void> {
    return undefined;
  }

  unload(): void {
    if (!this.#loaded) return;
    this.#loaded = false;
    try {
      this.onunload();
    } finally {
      for (const cleanup of this.#cleanups.splice(0).toReversed()) cleanup();
    }
  }

  onunload(): void {
    return undefined;
  }

  register(cleanup: () => unknown): void {
    this.#cleanups.push(cleanup);
  }

  registerEvent(ref: EventRef): void {
    this.register(() => releaseEvent(ref));
  }

  registerDomEvent<K extends keyof WindowEventMap>(
    element: Window,
    type: K,
    callback: DomListener<WindowEventMap[K]>,
    options?: Options,
  ): void;
  registerDomEvent<K extends keyof DocumentEventMap>(
    element: Document,
    type: K,
    callback: DomListener<DocumentEventMap[K]>,
    options?: Options,
  ): void;
  registerDomEvent<K extends keyof HTMLElementEventMap>(
    element: HTMLElement,
    type: K,
    callback: DomListener<HTMLElementEventMap[K]>,
    options?: Options,
  ): void;
  registerDomEvent(
    element: EventTarget,
    type: string,
    callback: DomListener<never>,
    options?: Options,
  ): void {
    const listener = callback as EventListener;
    element.addEventListener(type, listener, options);
    this.register(() => element.removeEventListener(type, listener, options));
  }

  registerInterval(id: number): number {
    this.register(() => window.clearInterval(id));
    return id;
  }
}
