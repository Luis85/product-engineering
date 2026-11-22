import type { CachedMetadata } from "obsidian";
import { Events } from "./events";
import type { TFile } from "./vault";
import { parseYaml, withoutBom, yamlBlock, yamlMap } from "./yaml";

export function nextTurn(): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, 0));
}

function metadata(raw: string): CachedMetadata {
  const block = yamlBlock(raw);
  if (!block) return {};

  const cache: CachedMetadata = { sections: [{ type: "yaml", position: block.position }] };
  try {
    const frontmatter = yamlMap(parseYaml(block.yaml));
    if (frontmatter) {
      cache.frontmatter = frontmatter;
      cache.frontmatterPosition = block.position;
    }
  } catch {
    // The host tracks the YAML section even when parsing fails.
  }
  return cache;
}

export class MetadataCache extends Events {
  readonly #cache = new WeakMap<TFile, CachedMetadata>();
  readonly #latest = new WeakMap<TFile, object>();
  readonly #pending = new Set<Promise<void>>();

  getFileCache(file: TFile): CachedMetadata | null {
    return this.#cache.get(file) ?? null;
  }

  index(file: TFile, text: string): void {
    const token = {};
    this.#latest.set(file, token);
    const pending = nextTurn().then(() => {
      if (this.#latest.get(file) !== token) return;
      const cache = metadata(text);
      this.#cache.set(file, cache);
      this.trigger("changed", file, withoutBom(text), cache);
      this.trigger("resolve", file);
      this.trigger("resolved");
    });
    this.#pending.add(pending);
    void pending.finally(() => {
      this.#pending.delete(pending);
    });
  }

  delete(file: TFile): void {
    const old = this.getFileCache(file);
    this.#latest.delete(file);
    this.#cache.delete(file);
    this.trigger("deleted", file, old);
  }

  async whenIndexed(): Promise<void> {
    if (this.#pending.size === 0) return;
    await Promise.all(this.#pending);
    return this.whenIndexed();
  }
}
