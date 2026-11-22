import type { Plugin } from "obsidian";
import { uuidGeneratorLayer } from "./id-generator";
import { noteOpenerLayer } from "./note-opener";
import { noteStoreLayer } from "./note-store";

export function notesAdapters(plugin: Plugin) {
  return {
    noteStore: noteStoreLayer(plugin.app),
    noteOpener: noteOpenerLayer(plugin.app),
    idGenerator: uuidGeneratorLayer,
  };
}
