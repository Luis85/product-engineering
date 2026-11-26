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
    const frontmatter = yamlMap(parseYaml(block.yaml.replace(/\r(?!\n)/g, "\n")));
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
  readonly #sources = new Map<TFile, { readonly text: string }>();
  readonly #pending = new Set<Promise<void>>();

  getFileCache(file: TFile): CachedMetadata | null {
    return this.#cache.get(file) ?? null;
  }

  index(file: TFile, text: string): void {
    const source = { text };
    this.#sources.set(file, source);
    void this.#track(nextTurn().then(() => this.#indexCurrent(file, source)));
  }

  #indexCurrent(file: TFile, source: { readonly text: string }): void {
    if (this.#sources.get(file) !== source) return;
    const cache = metadata(source.text);
    this.#cache.set(file, cache);
    this.trigger("changed", file, withoutBom(source.text), cache);
    this.trigger("resolve", file);
    this.trigger("resolved");
  }

  #track(pending: Promise<void>): Promise<void> {
    this.#pending.add(pending);
    void pending.finally(() => {
      this.#pending.delete(pending);
    });
    return pending;
  }

  startCold(): Promise<void> {
    const files = [...this.#sources].map(([file, previous]) => {
      const source = { text: previous.text };
      this.#cache.delete(file);
      this.#sources.set(file, source);
      return [file, source] as const;
    });
    return this.#track(
      (async () => {
        for (const [file, source] of files) {
          // oxlint-disable-next-line eslint/no-await-in-loop -- Cold indexing advances one file per turn.
          await nextTurn();
          this.#indexCurrent(file, source);
        }
      })(),
    );
  }

  async resolveAll(): Promise<void> {
    await nextTurn();
    for (const file of this.#sources.keys()) {
      if (this.#cache.has(file)) this.trigger("resolve", file);
    }
    this.trigger("resolved");
  }

  delete(file: TFile): void {
    const old = this.getFileCache(file);
    this.#sources.delete(file);
    this.#cache.delete(file);
    this.trigger("deleted", file, old);
  }

  async whenIndexed(): Promise<void> {
    if (this.#pending.size === 0) return;
    await Promise.all(this.#pending);
    return this.whenIndexed();
  }
}
