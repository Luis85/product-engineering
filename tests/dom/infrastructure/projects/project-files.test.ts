import { Effect } from "effect";
import { Plugin } from "obsidian";
import { expect, it, vi } from "vitest";
import { createTestPlugin } from "@test/obsidian";
import { ProjectFiles } from "../../../../src/application/projects";
import { projectFilesLayer } from "../../../../src/infrastructure/obsidian/projects";

vi.mock("obsidian", async () => {
  const [host, { parse }] = await Promise.all([import("@test/obsidian"), import("yaml")]);
  // Bases use nested YAML. The shared Markdown double deliberately checks flat frontmatter.
  return {
    ...host,
    parseYaml: (text: string): unknown => parse(text, { version: "1.2", schema: "core" }),
  };
});

class ProjectPlugin extends Plugin {}

const id = "project-33333333-3333-4333-8333-000000000001";

async function setup() {
  const { plugin, registry } = createTestPlugin(ProjectPlugin);
  const { vault, workspace } = registry.plugin.app;
  const files = await Effect.runPromise(
    Effect.provide(ProjectFiles, projectFilesLayer(plugin.app.vault, plugin.app.workspace)),
  );
  return { vault, workspace, files };
}

it("reserves a fresh folder beside existing case-equivalent folders and files", async () => {
  const { vault, files } = await setup();
  const sentinel = await vault.seedFile("Products/Projects/Kundenportal/Sentinel.md", "keep");
  await vault.seedFile("Products/Projects/kundenportal (2)", "occupied by a file");
  await expect(
    Effect.runPromise(files.reserveFolder("products/projects", "KUNDENPORTAL")),
  ).resolves.toBe("Products/Projects/KUNDENPORTAL (3)");
  expect(await vault.read(sentinel)).toBe("keep");
  await vault.seedFile("Blocked", "not a folder");
  await expect(
    Effect.runPromise(files.reserveFolder("Blocked/Projects", "Project")),
  ).rejects.toMatchObject({
    _tag: "ProjectStorageError",
    reason: "folder",
  });
});

it("creates a scoped Base once and leaves its edited views intact on retry", async () => {
  const { vault, files } = await setup();
  const folder = await Effect.runPromise(files.reserveFolder("Products/Projects", "Kundenportal"));
  const path = `${folder}/Backlog.base`;
  await expect(Effect.runPromise(files.hasBacklog(path, id))).resolves.toBe(false);
  await Effect.runPromise(files.ensureBacklog(path, id));
  await expect(Effect.runPromise(files.hasBacklog(path, id))).resolves.toBe(true);
  const current = vault.getFileByPath(path);
  if (!current) throw new Error("The scoped Base is missing");
  const revised = (await vault.read(current)).replace("name: Backlog", "name: Work in progress");
  await vault.process(current, () => revised);
  await Effect.runPromise(files.ensureBacklog(path, id));
  expect(await vault.read(current)).toBe(revised);
});

it.each(["\n", "plain text\n", "[]\n", "views: []\n", "filters: other\n"])(
  "keeps an unassigned Base at the expected path %j",
  async (content) => {
    const { vault, files } = await setup();
    const path = "Products/Projects/Kundenportal/Backlog.base";
    const existing = await vault.seedFile(path, content);
    await expect(Effect.runPromise(files.ensureBacklog(path, id))).rejects.toMatchObject({
      _tag: "ProjectStorageError",
      reason: "base",
    });
    await expect(Effect.runPromise(files.hasBacklog(path, id))).rejects.toMatchObject({
      _tag: "ProjectStorageError",
      reason: "base",
    });
    expect(await vault.read(existing)).toBe(content);
  },
);

it("refuses a folder occupying the assigned Base path", async () => {
  const { vault, files } = await setup();
  const path = "Products/Projects/Kundenportal/Backlog.base";
  await vault.createFolder(path);
  await expect(Effect.runPromise(files.ensureBacklog(path, id))).rejects.toMatchObject({
    _tag: "ProjectStorageError",
    reason: "base",
  });
  expect(vault.getFolderByPath(path)).not.toBeNull();
});

it("accepts an existing backlog Base scoped to its project without rewriting it", async () => {
  const { vault, files } = await setup();
  const folder = "Products/Projects/Kundenportal";
  const contents = `# protected\nfilters:\n  and:\n    - 'file.inFolder("${folder}/Work")'\n    - 'file.ext == "md"'\n    - 'file.name != "README"'\nviews:\n  - type: product-backlog\n    name: Existing backlog\n    homeFolder: ${folder}/Work\n    stateProperty: note.DeliveryState\n    stateValues: Open, Active, Done\n`;
  const path = `${folder}/Existing.base`;
  const base = await vault.seedFile(path, contents);
  await expect(Effect.runPromise(files.hasBacklog(path, id))).resolves.toBe(true);
  await Effect.runPromise(files.ensureBacklog(path, id));
  expect(await vault.read(base)).toBe(contents);
  const foreign = `${folder}/Foreign.base`;
  await vault.seedFile(
    foreign,
    contents.replaceAll(`${folder}/Work`, "Products/Projects/Admin Console"),
  );
  await expect(Effect.runPromise(files.hasBacklog(foreign, id))).rejects.toMatchObject({
    reason: "base",
  });
});

const backlogFolder = "Products/Projects/Kundenportal";
const folderFilter = `'file.inFolder("${backlogFolder}")'`;

it.each([
  { filter: "and: []\n  or: []", option: "" },
  { filter: `and: [${folderFilter}, 'file.inFolder("${backlogFolder}/Another")']`, option: "" },
  { filter: folderFilter, option: "homeFolder: Products/Projects/Admin Console" },
  { filter: folderFilter, option: "stateProperty: formula.activation" },
  { filter: folderFilter, option: "assigneeProperty: note.order" },
  { filter: folderFilter, option: "stateProperty: note.ASSIGNEE" },
  { filter: `'file.name != "Archive"'`, option: "" },
])(
  "rejects an unverified Base scope or mapping $filter $option",
  async ({ filter: scope, option }) => {
    const { vault, files } = await setup();
    const path = backlogFolder + "/Unsafe.base";
    const bytes =
      (scope.startsWith("and:") ? "filters:\n  " : "filters: ") +
      scope +
      "\nviews:\n  - type: product-backlog\n    name: Imported\n" +
      (option ? "    " + option + "\n" : "");
    const existing = await vault.seedFile(path, bytes);
    await expect(Effect.runPromise(files.readBacklog(path, id))).rejects.toMatchObject({
      reason: "base",
    });
    expect(await vault.read(existing)).toBe(bytes);
  },
);

it("opens the registered Base in a native tab and refuses a Markdown or missing path", async () => {
  const { vault, workspace, files } = await setup();
  const requested = vi.spyOn(workspace, "getLeaf");
  const base = backlogFolder + "/Backlog.base";
  const note = backlogFolder + "/Backlog.md";
  await vault.seedFile(base, "views: []\n");
  await vault.seedFile(note, "# Notes");
  await expect(Effect.runPromise(files.openBacklog(base))).resolves.toBeUndefined();
  expect(requested).toHaveBeenCalledExactlyOnceWith("tab");
  await expect(Effect.runPromise(files.openBacklog(note))).rejects.toMatchObject({
    reason: "base",
  });
  await expect(
    Effect.runPromise(files.openBacklog(backlogFolder + "/Missing.base")),
  ).rejects.toMatchObject({ reason: "base" });
});
