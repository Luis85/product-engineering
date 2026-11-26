import { Plugin } from "obsidian";
import type { App as ObsidianApp, MarkdownRenderer } from "obsidian";
import { expect, it, vi } from "vitest";
import { App, createTestPlugin } from "@test/obsidian";
import { markdownHost } from "../../../../src/infrastructure/obsidian/shell/markdown-host";
import { previewMarkdown } from "../../../../src/infrastructure/obsidian/shell/preview-markdown";

const { render } = vi.hoisted(() => ({ render: vi.fn<typeof MarkdownRenderer.render>() }));
vi.mock("obsidian", async () => ({
  ...(await import("@test/obsidian")),
  MarkdownRenderer: { render },
  parseLinktext: (link: string) => ({ path: link.split("#")[0] }),
}));

const source = "Projects/Source.md";
const guide = "Attachments/B/Guide.md";
const raster = "Attachments/B/Picture.png";
const audio = "Attachments/B/Audio.mp3";
const unsafe = "Attachments/B/Page.html";
const ambiguous = "Attachments/B/Bad#Name.md";

async function fixture() {
  const app = new App();
  const { plugin } = createTestPlugin(class extends Plugin {}, { app });
  const files = await Promise.all(
    [source, guide, raster, audio, unsafe, ambiguous].map((path) =>
      app.vault.seedFile(path, "## Existing"),
    ),
  );
  const resolve = vi.fn<(link: string) => ReturnType<typeof app.vault.getFileByPath>>((link) =>
    app.vault.getFileByPath(link),
  );
  const open = vi.fn<ObsidianApp["workspace"]["openLinkText"]>().mockResolvedValue(undefined);
  const makeLink = vi
    .fn<ObsidianApp["fileManager"]["generateMarkdownLink"]>()
    .mockReturnValue("[[Attachments/B/Picture.png]]");
  const cache = app.metadataCache.getFileCache.bind(app.metadataCache);
  Object.assign(app.vault, { getFiles: () => files });
  Object.assign(app.metadataCache, {
    getFirstLinkpathDest: resolve,
    getFileCache: (file: (typeof files)[number]) =>
      file.path === source
        ? {
            headings: [{ heading: "Existing" }],
            links: [
              {
                link: guide,
                displayText: "Guide alias",
                original: "[[Guide|Guide alias]]",
                position: { start: { offset: 20 } },
              },
              {
                link: "Missing.md",
                original: "[[Missing.md]]",
                position: { start: { offset: 40 } },
              },
            ],
            embeds: [
              { link: raster, original: "![[Picture.png]]", position: { start: { offset: 1 } } },
            ],
          }
        : cache(file),
    resolvedLinks: {
      [source]: { [source]: 1 },
      [guide]: { [source]: 1 },
      [unsafe]: { [raster]: 1 },
    },
  });
  Object.assign(app.workspace, { openLinkText: open });
  Object.assign(app.fileManager, { generateMarkdownLink: makeLink });
  return { app, host: markdownHost(plugin.app), resolve, open, makeLink, files };
}

it("uses host paths and metadata for candidates, generation, resolution and backlinks", async () => {
  const { host, resolve, open, makeLink, files } = await fixture();
  expect(host.files().map(({ path, kind }) => [path, kind])).toEqual([
    [source, "note"],
    [guide, "note"],
    [raster, "image"],
    [audio, "attachment"],
    [unsafe, "unsupported"],
    [ambiguous, "unsupported"],
  ]);
  expect(host.files()[0]?.headings).toEqual(["Existing"]);
  expect(host.makeLink({ path: raster, heading: "", alias: "caption", embed: true }, source)).toBe(
    "![[Attachments/B/Picture.png]]",
  );
  expect(makeLink).toHaveBeenCalledWith(files[2], source, "", "caption");
  expect(
    host.makeLink({ path: unsafe, heading: "", alias: "", embed: false }, source),
  ).toBeUndefined();
  expect(
    host.makeLink({ path: "No file", heading: "", alias: "", embed: false }, source),
  ).toBeUndefined();
  expect(host.resolve("[[#Existing]]", source)).toEqual({ path: source, supported: true });
  expect(host.resolve("[[Missing.md]]", source)).toBeUndefined();
  expect(host.resolve(unsafe, source)).toEqual({ path: unsafe, supported: false });
  await host.open("[[" + guide + "#Existing|Guide title]]", source);
  await host.open("[[Missing.md]]", source);
  await host.open(unsafe, source);
  expect(resolve).toHaveBeenCalledWith(guide, source);
  expect(open).toHaveBeenCalledExactlyOnceWith(guide + "#Existing", source, true);
  expect(host.noteLinks(source)).toEqual({
    inline: [
      { link: raster, label: raster, original: "![[Picture.png]]" },
      { link: guide, label: "Guide alias", original: "[[Guide|Guide alias]]" },
      { link: "Missing.md", label: "Missing.md", original: "[[Missing.md]]" },
    ],
    inbound: [guide],
  });
  expect(host.noteLinks("Missing.md")).toEqual({ inline: [], inbound: [] });
});

it("mounts the native rendering in the owning document and unloads link handlers on abort", async () => {
  const { app, host, open } = await fixture();
  const container = document.createElement("section");
  const signal = new AbortController();
  const body = "![[" + raster + "]] ![[" + unsafe + "]]";
  render.mockReset().mockImplementation((_app: unknown, _markdown: string, node: HTMLElement) => {
    const button = node.ownerDocument.createElement("a");
    button.classList.add("internal-link");
    button.setAttribute("data-href", guide);
    node.append(button, node.ownerDocument.createElement("p"));
    return Promise.resolve();
  });
  await host.render(body, source, container, signal.signal);
  expect(render).toHaveBeenCalledExactlyOnceWith(
    app,
    body.replace("![[" + unsafe, "[[" + unsafe),
    expect.any(HTMLElement),
    source,
    expect.anything(),
  );
  const link = container.querySelector("a");
  expect(link?.ownerDocument).toBe(container.ownerDocument);
  container.querySelector("p")?.click();
  link?.click();
  expect(open).toHaveBeenCalledExactlyOnceWith(guide, source, true);
  signal.abort();
  expect(container.children).toHaveLength(0);
  link?.click();
  expect(open).toHaveBeenCalledTimes(1);
});

it("leaves a late canceled render detached and surfaces an active renderer failure", async () => {
  const { host } = await fixture();
  const container = document.createElement("section");
  const signal = new AbortController();
  let finish: (() => void) | undefined;
  render.mockReset().mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  const pending = host.render("Text", source, container, signal.signal);
  signal.abort();
  finish?.();
  await pending;
  expect(container.children).toHaveLength(0);
  render.mockRejectedValue(new Error("Markdown renderer failed"));
  await expect(
    host.render("Text", source, container, new AbortController().signal),
  ).rejects.toThrow("Markdown renderer failed");
});

it("keeps literal code, local raster syntax and stored Markdown separate from active preview resources", () => {
  const sourceText = [
    "<img src=elsewhere> ![Remote](https://example.invalid/one.png) ![Other][ref]",
    "`<iframe src=elsewhere>` ![Local](Picture.png) ![[Picture.png]]",
    "~~~md",
    "<iframe src=example> ![Text](example)",
    "~~~",
    "<object></object>",
    "```md ` malformed fence",
    "<script>sample</script>",
  ].join("\r\n");
  const result = previewMarkdown(sourceText, (target) => target === "Picture.png");
  expect(result).toBe(
    [
      "&lt;img src=elsewhere> [Remote](https://example.invalid/one.png) [Other][ref]",
      "`<iframe src=elsewhere>` ![Local](Picture.png) ![[Picture.png]]",
      "~~~md",
      "<iframe src=example> ![Text](example)",
      "~~~",
      "&lt;object>&lt;/object>",
      "```md ` malformed fence",
      "&lt;script>sample&lt;/script>",
    ].join("\r\n"),
  );
});
