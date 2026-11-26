import { installDomExtensions } from "./obsidian";

installDomExtensions(window);
Object.defineProperty(globalThis, "activeDocument", {
  value: document,
  configurable: true,
  writable: true,
});
Object.defineProperty(globalThis, "createFragment", {
  value(callback?: (fragment: DocumentFragment) => void) {
    const fragment = activeDocument.createDocumentFragment();
    callback?.(fragment);
    return fragment;
  },
  configurable: true,
  writable: true,
});
