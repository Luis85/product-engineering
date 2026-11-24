import { Component, MarkdownRenderer } from "obsidian";
import type { App, TFile } from "obsidian";
import type { MarkdownHost, VaultFile } from "../../../presentation/shell/host";
import { resolveVaultLink, vaultLinkText } from "../vault-link";
import { previewMarkdown } from "./preview-markdown";

const images = new Set(["avif", "bmp", "gif", "jpeg", "jpg", "png", "webp"]);
const attachments = new Set(["pdf", "mp3", "wav", "m4a", "ogg", "mp4", "webm", "mov", "txt"]);

function kindOf(file: TFile): VaultFile["kind"] {
  if (/[#[\]|]/.test(file.path)) return "unsupported";
  const extension = file.extension.toLowerCase();
  if (extension === "md") return "note";
  if (images.has(extension)) return "image";
  return attachments.has(extension) ? "attachment" : "unsupported";
}

function resolveFile(app: App, link: string, source: string) {
  return resolveVaultLink(app.vault, app.metadataCache, link, source);
}

export function markdownHost(app: App): MarkdownHost {
  const open: MarkdownHost["open"] = async (link, source) => {
    const file = resolveFile(app, link, source);
    if (file && kindOf(file) !== "unsupported")
      await app.workspace.openLinkText(vaultLinkText(link), source, true);
  };
  return {
    open,
    files: () =>
      app.vault.getFiles().map((file) => ({
        path: file.path,
        name: file.basename,
        kind: kindOf(file),
        headings:
          app.metadataCache.getFileCache(file)?.headings?.map(({ heading }) => heading) ?? [],
      })),
    makeLink({ path, heading, alias, embed }, source) {
      const file = app.vault.getFileByPath(path);
      if (!file || kindOf(file) === "unsupported") return;
      const raw = app.fileManager.generateMarkdownLink(file, source, heading, alias);
      return embed && !raw.startsWith("!") ? "!" + raw : raw;
    },
    resolve(link, source) {
      const file = resolveFile(app, link, source);
      return file ? { path: file.path, supported: kindOf(file) !== "unsupported" } : undefined;
    },
    noteLinks(source) {
      const file = app.vault.getFileByPath(source);
      const cache = file && app.metadataCache.getFileCache(file);
      const inline = [...(cache?.links ?? []), ...(cache?.embeds ?? [])]
        .toSorted((a, b) => a.position.start.offset - b.position.start.offset)
        .map(({ link, displayText, original }) => ({ link, label: displayText || link, original }));
      const inbound = Object.entries(app.metadataCache.resolvedLinks)
        .filter(([path, links]) => path !== source && Object.hasOwn(links, source))
        .map(([path]) => path)
        .toSorted();
      return { inline, inbound };
    },
    async render(source, path, container, signal) {
      const lifecycle = new Component();
      lifecycle.load();
      const rendered = container.ownerDocument.createElement("div");
      const release = () => {
        lifecycle.unload();
        rendered.remove();
      };
      signal.addEventListener("abort", release, { once: true });
      lifecycle.registerDomEvent(rendered, "click", (event) => {
        const target = event.target;
        if (!target || !("closest" in target)) return;
        const link = (target as Element).closest("a.internal-link")?.getAttribute("data-href");
        if (!link) return;
        event.preventDefault();
        event.stopPropagation();
        void open(link, path);
      });
      try {
        const markdown = previewMarkdown(source, (target) => {
          if (/^(?:[a-z][\w+.-]*:|\/\/)/i.test(target)) return false;
          const file = resolveFile(app, target, path);
          return file ? kindOf(file) === "image" : false;
        });
        await MarkdownRenderer.render(app, markdown, rendered, path, lifecycle);
        if (!signal.aborted) container.replaceChildren(rendered);
      } catch (error) {
        release();
        if (!signal.aborted) throw error;
      }
    },
  };
}
