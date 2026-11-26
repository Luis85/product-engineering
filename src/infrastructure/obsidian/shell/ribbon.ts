import type { Plugin } from "obsidian";
import { PRODUCT_NAME } from "../../../application/shell";

export function addRibbonIcon(plugin: Plugin, open: () => Promise<unknown>): HTMLElement {
  return plugin.addRibbonIcon("layout-dashboard", PRODUCT_NAME, () => {
    void open();
  });
}
