import type { Plugin } from "obsidian";
import type { AppEvent } from "../../../src/application/events";

function cacheMark(plugin: Plugin, since: number) {
  const at = performance.now() - since;
  const files = plugin.app.vault.getMarkdownFiles();
  let cached = 0;
  let frontmatter = 0;
  for (const file of files) {
    const entry = plugin.app.metadataCache.getFileCache(file);
    if (entry !== null) cached += 1;
    if (entry?.frontmatter !== undefined) frontmatter += 1;
  }
  return { at, markdown: files.length, cached, frontmatter };
}

type CacheMark = ReturnType<typeof cacheMark>;
type HostMark = CacheMark & { readonly resolved: number };

export function observeStartup(plugin: Plugin) {
  const { vault, metadataCache, workspace } = plugin.app;
  const since = performance.now();
  const mark = () => cacheMark(plugin, since);
  const initial = mark();
  const events = { create: 0, changed: 0, resolve: 0, resolved: 0 };
  const host = { layout: [] as HostMark[], vault: [] as HostMark[] };
  let layout: CacheMark | null = null;
  let firstResolved: CacheMark | null = null;
  let lastResolvedAt: number | null = null;
  let indexReady: { readonly at: number; readonly records: number } | null = null;
  let open = true;

  plugin.register(() => {
    open = false;
  });
  plugin.registerEvent(
    vault.on("create", () => {
      events.create += 1;
    }),
  );
  plugin.registerEvent(
    metadataCache.on("changed", () => {
      events.changed += 1;
    }),
  );
  plugin.registerEvent(
    metadataCache.on("resolve", () => {
      events.resolve += 1;
    }),
  );
  plugin.registerEvent(
    metadataCache.on("resolved", () => {
      events.resolved += 1;
      firstResolved ??= mark();
      lastResolvedAt = performance.now() - since;
    }),
  );
  workspace.onLayoutReady(() => {
    if (open) layout = mark();
  });

  return {
    recordHost({ _tag }: AppEvent) {
      if (_tag === "LayoutReady") host.layout.push({ ...mark(), resolved: events.resolved });
      if (_tag === "VaultReady") host.vault.push({ ...mark(), resolved: events.resolved });
    },
    recordIndexReady(records: number) {
      indexReady ??= { at: performance.now() - since, records };
    },
    facts() {
      return {
        initial,
        layout,
        firstResolved,
        lastResolvedAt,
        current: mark(),
        events: { ...events },
        host: { layout: [...host.layout], vault: [...host.vault] },
        indexReady,
      };
    },
  };
}

export type StartupRecorder = ReturnType<typeof observeStartup>;
