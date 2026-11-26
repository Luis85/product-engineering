import type { App, TFile } from "obsidian";

export function cacheCompleteness({ vault, metadataCache }: Pick<App, "vault" | "metadataCache">) {
  let waiting: readonly TFile[] = [];
  let next = 0;

  const uncached = (file: TFile) => metadataCache.getFileCache(file) === null;

  return () => {
    for (let file = waiting[next]; file !== undefined; file = waiting[next]) {
      if (vault.getFileByPath(file.path) === file && uncached(file)) return false;
      next += 1;
    }

    // The initial scan takes a snapshot. The last scan finds any additions since it.
    waiting = vault.getMarkdownFiles().filter(uncached);
    next = 0;
    return waiting.length === 0;
  };
}
