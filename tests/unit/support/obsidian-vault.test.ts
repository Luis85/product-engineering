// @vitest-environment happy-dom
import { expect, it, vi } from "vitest";
import { App, parseYaml, stringifyYaml, TFile, TFolder, YAMLParseError } from "@test/obsidian";
import { eventually } from "../../support/wait";

it("defines folders and file identities, and indexes writes on a separate turn", async () => {
  const app = new App();
  const created: unknown[] = [];
  app.vault.on("create", (entry) => {
    created.push(entry);
  });

  await expect(app.vault.create("Records/Nested/One.md", "")).rejects.toThrow(
    "Test vault parent folder was not found",
  );
  const folder = await app.vault.createFolder("Records/Nested");
  const write = app.vault.create("Records/Nested/One.md", "---\nactive: true\n---\nBody");
  expect(app.vault.getFileByPath("Records/Nested/One.md")).toBeNull();
  const file = await write;

  expect(folder).toBeInstanceOf(TFolder);
  expect(file).toBeInstanceOf(TFile);
  expect(file.parent).toBe(folder);
  expect(folder.children).toEqual([file]);
  expect(created.map((entry) => (entry instanceof TFile ? "file" : "folder"))).toEqual([
    "folder",
    "folder",
    "file",
  ]);
  expect(app.metadataCache.getFileCache(file)).toBeNull();
  await app.metadataCache.whenIndexed();
  expect(app.metadataCache.getFileCache(file)?.frontmatter?.active).toBe(true);
  expect(app.vault.getMarkdownFiles()).toEqual([file]);
  expect(app.vault.getRoot().children).toEqual([app.vault.getFolderByPath("Records")]);
});

it("keeps exact paths but detects case and Unicode clashes on insensitive disks", async () => {
  const app = new App({ caseInsensitive: true });
  const nfd = "Folder/Ty\u0301.md";
  const file = await app.vault.seedFile(nfd, "\uFEFFBody");
  expect(app.vault.getFileByPath(nfd)).toBe(file);
  expect(app.vault.getFileByPath(nfd.normalize("NFC"))).toBeNull();
  await expect(app.vault.create("Folder/tý.md", "")).rejects.toMatchObject({ code: "EEXIST" });
  await expect(app.vault.create("Folder\\Another.md", "")).rejects.toThrow(
    "The test vault requires a normalized path",
  );
  await expect(app.vault.cachedRead(file)).resolves.toBe("Body");

  await app.fileManager.renameFile(file, "Folder/TÝ.md");
  expect(app.vault.getAbstractFileByPath("Folder/TÝ.md")).toBe(file);
  expect(app.vault.getFileByPath(nfd)).toBeNull();
});

it("reports an unreadable YAML section without parsed frontmatter", async () => {
  const app = new App();
  const file = await app.vault.seedFile("Malformed.md", "---\r\nschema: [\r\n---\r\nBody");
  await app.metadataCache.whenIndexed();
  const cache = app.metadataCache.getFileCache(file);
  expect(cache?.sections?.[0]).toMatchObject({
    type: "yaml",
    position: { start: { line: 0 }, end: { line: 2 } },
  });
  expect(cache?.frontmatter).toBeUndefined();
  expect(cache?.frontmatterPosition).toBeUndefined();
});

it("indexes edits separately and reports deletion before resolving the vault", async () => {
  const app = new App();
  const file = await app.vault.seedFile("Record.md", "---\ncount: 1\n---\nBody");
  await app.metadataCache.whenIndexed();
  await app.vault.process(file, (text) => text.replace("count: 1", "count: 2"));
  expect(app.metadataCache.getFileCache(file)?.frontmatter?.count).toBe(1);
  await app.metadataCache.whenIndexed();
  expect(app.metadataCache.getFileCache(file)?.frontmatter?.count).toBe(2);

  await app.fileManager.processFrontMatter(file, (data) => {
    data.count = 3;
  });
  await app.metadataCache.whenIndexed();
  expect(app.metadataCache.getFileCache(file)?.frontmatter?.count).toBe(3);
  await expect(app.vault.read(file)).resolves.toContain("Body");

  const events: string[] = [];
  app.metadataCache.on("deleted", () => events.push("metadata"));
  app.vault.on("delete", () => events.push("vault"));
  app.metadataCache.on("resolved", () => events.push("resolved"));
  await expect(app.fileManager.trashFile(file)).resolves.toBe(true);
  expect(events).toEqual(["metadata", "vault", "resolved"]);
  expect(app.metadataCache.getFileCache(file)).toBeNull();
});

it("parses YAML 1.2 scalars and reports malformed YAML", () => {
  const text = "legacy: yes\r\nvalues: [0, true, null, '']";
  const expected = { legacy: "yes", values: [0, true, null, ""] };
  expect(parseYaml(text)).toEqual(expected);
  expect(parseYaml(stringifyYaml(expected))).toEqual(expected);
  expect(() => parseYaml("schema: [")).toThrow(YAMLParseError);
});

it("passes raw BOM and CRLF bytes to process and preserves them when editing", async () => {
  const app = new App();
  const raw = "\uFEFF---\r\ntitle: Old\r\n---\r\nText\r\n";
  const file = await app.vault.seedFile("Bytes.md", raw);
  await app.metadataCache.whenIndexed();
  const modified = vi.fn<() => void>();
  app.vault.on("modify", modified);

  const unchanged = vi.fn<(text: string) => string>((text) => text);
  await expect(app.vault.process(file, unchanged)).resolves.toBe(raw);
  expect(unchanged).toHaveBeenCalledExactlyOnceWith(raw);
  expect(modified).not.toHaveBeenCalled();

  const replacement = raw.replace("Old", "New");
  await expect(app.vault.process(file, (text) => text.replace("Old", "New"))).resolves.toBe(
    replacement,
  );
  expect(modified).toHaveBeenCalledOnce();
  expect(app.metadataCache.getFileCache(file)?.frontmatter?.title).toBe("Old");
  await app.metadataCache.whenIndexed();
  expect(app.metadataCache.getFileCache(file)?.frontmatter?.title).toBe("New");
});

it("rejects a thrown process callback or a deleted file without modifying the vault", async () => {
  const app = new App();
  const file = await app.vault.seedFile("Gone.md", "Original");
  const modified = vi.fn<() => void>();
  app.vault.on("modify", modified);
  const cause = new Error("Rejected test edit");
  await expect(
    app.vault.process(file, () => {
      throw cause;
    }),
  ).rejects.toBe(cause);
  await expect(app.vault.read(file)).resolves.toBe("Original");
  expect(modified).not.toHaveBeenCalled();

  app.vault.holdWrites();
  const edit = vi.fn<(text: string) => string>().mockReturnValue("Replacement");
  const pending = app.vault.process(file, edit);
  try {
    await eventually(() => expect(app.vault.heldWrites()).toBe(1));
    await app.vault.removeOutside(file.path);
  } finally {
    app.vault.releaseWrites();
  }
  await expect(pending).rejects.toMatchObject({ code: "ENOENT" });
  expect(edit).not.toHaveBeenCalled();
  expect(modified).not.toHaveBeenCalled();
});

it.each(["----", "-----", "---- ", "--- x", "---x", "--- # c", "---  \t"])(
  "indexes frontmatter closed by %s",
  async (close) => {
    const app = new App();
    const file = await app.vault.seedFile(
      "Fence.md",
      "\uFEFF---\r\ntitle: A note\r\n" + close + "\r\nBody",
    );
    await app.metadataCache.whenIndexed();
    expect(app.metadataCache.getFileCache(file)?.frontmatter?.title).toBe("A note");
  },
);

it("indexes YAML frontmatter in a note with legacy CR line endings", async () => {
  const app = new App();
  const file = await app.vault.seedFile(
    "Carriage.md",
    "---\rtitle: A note\rstatus: open\r---\rBody",
  );
  await app.metadataCache.whenIndexed();
  expect(app.metadataCache.getFileCache(file)?.frontmatter).toEqual({
    title: "A note",
    status: "open",
  });
});

it("re-indexes a cold vault one file at a time on separate turns", async () => {
  const { metadataCache, vault } = new App({ layoutReady: false });
  const files = [
    await vault.seedFile("One.md", "---\ntitle: First\n---\nBody"),
    await vault.seedFile("Two.md", "No frontmatter."),
  ];
  await metadataCache.whenIndexed();
  expect(files.map((file) => metadataCache.getFileCache(file))).toEqual([
    expect.objectContaining({ frontmatter: { title: "First" } }),
    {},
  ]);

  const trace: string[] = [];
  metadataCache.on("changed", () => trace.push("changed"));
  metadataCache.on("resolve", () => trace.push("resolve"));
  metadataCache.on("resolved", () => {
    const count = files.filter((file) => metadataCache.getFileCache(file) !== null).length;
    trace.push(`resolved ${count}`);
    queueMicrotask(() => trace.push("turn ended"));
  });
  const cold = metadataCache.startCold();
  expect(files.map((file) => metadataCache.getFileCache(file))).toEqual([null, null]);
  await cold;
  expect(trace).toEqual([
    "changed",
    "resolve",
    "resolved 1",
    "turn ended",
    "changed",
    "resolve",
    "resolved 2",
    "turn ended",
  ]);
});

it("emits one vault resolution on warm startup without changing the cache", async () => {
  const { metadataCache, vault } = new App();
  const first = await vault.seedFile("One.md", "---\ntitle: First\n---\nBody");
  const second = await vault.seedFile("Two.md", "No frontmatter.");
  await metadataCache.whenIndexed();
  const cached = metadataCache.getFileCache(first);

  const trace: unknown[] = [];
  metadataCache.on("changed", () => trace.push("changed"));
  metadataCache.on("resolve", (file) => trace.push(file));
  metadataCache.on("resolved", () => trace.push("resolved"));
  await metadataCache.resolveAll();
  expect(trace).toEqual([first, second, "resolved"]);
  expect(metadataCache.getFileCache(first)).toBe(cached);
});
