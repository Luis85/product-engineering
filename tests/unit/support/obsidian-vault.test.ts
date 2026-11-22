// @vitest-environment happy-dom
import { expect, it } from "vitest";
import { App, parseYaml, stringifyYaml, TFile, TFolder, YAMLParseError } from "@test/obsidian";

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
