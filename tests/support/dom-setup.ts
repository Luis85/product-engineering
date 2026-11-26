import { installDomExtensions } from "./obsidian";

installDomExtensions(window);
Object.defineProperty(globalThis, "activeDocument", {
  value: document,
  configurable: true,
  writable: true,
});
