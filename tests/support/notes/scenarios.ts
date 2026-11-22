import type { App, CachedMetadata, TFile } from "obsidian";
import { frontmatterYaml, splitNoteText } from "../../../src/domain/notes";
import { waitForVault } from "../readiness-scenario";
import { FENCE_CASES, LINE_EDIT_CASES, fenceText, yamlSampleValue } from "./fidelity";
import type { NoteStoreProbeApi, ProbeResult } from "./probe-api";

type VaultHost = Pick<App, "vault" | "metadataCache" | "fileManager">;
type VaultFunctions = {
  readonly normalizePath: (path: string) => string;
  readonly parseYaml: (text: string) => unknown;
  readonly stringifyYaml: (value: unknown) => string;
};

function rejected(run: () => Promise<unknown>): Promise<boolean> {
  return run().then(
    () => false,
    () => true,
  );
}

function valueOf<T>(result: ProbeResult<T>): T {
  if (!result.success) throw new Error("Unexpected store result " + result.error);
  return result.value;
}

function waitForCache(app: VaultHost, file: TFile): Promise<CachedMetadata> {
  return waitForVault(
    () => app.metadataCache.getFileCache(file) ?? undefined,
    "cache for " + file.path,
  );
}

function fileAt(app: VaultHost, path: string): TFile {
  const file = app.vault.getFileByPath(path);
  if (!file) throw new Error("Missing fixture file " + path);
  return file;
}

function yamlFacts(api: VaultFunctions) {
  const values = { title: "Notes", enabled: true, tags: ["alpha", "beta"] };
  const tagged = api.parseYaml('due: !!str 2026-11-22\nleading: "01067"\nenabled: true\n');
  const date =
    typeof tagged === "object" && tagged !== null && "due" in tagged ? tagged.due : undefined;

  let rejectsBadYaml = false;
  try {
    api.parseYaml("title: [");
  } catch {
    rejectsBadYaml = true;
  }

  return {
    tagged,
    taggedDateType: typeof date,
    roundTrip: api.parseYaml(api.stringifyYaml(values)),
    rejectsBadYaml,
  };
}

function observeVault(app: VaultHost, folder: string) {
  const events: string[] = [];
  const add = (type: string, path: string) => {
    if (path === folder || path.startsWith(folder + "/")) events.push(type + ":" + path);
  };
  const refs = [
    app.vault.on("create", (file) => add("create", file.path)),
    app.vault.on("modify", (file) => add("modify", file.path)),
    app.vault.on("rename", (file, previous) => add("rename", previous + ">" + file.path)),
    app.vault.on("delete", (file) => add("delete", file.path)),
  ];
  return {
    events,
    stop: () => {
      for (const ref of refs) app.vault.offref(ref);
    },
  };
}

function titleOf(app: VaultHost, file: TFile): unknown {
  return app.metadataCache.getFileCache(file)?.frontmatter?.title as unknown;
}

async function editNativeNote(app: VaultHost, file: TFile) {
  const before = titleOf(app, file);
  const processResult = await app.vault.process(file, (text) => text.replace("Native", "Edited"));
  const afterProcess = titleOf(app, file);
  await waitForVault(
    () => (titleOf(app, file) === "Edited" ? true : undefined),
    "processed frontmatter",
  );

  await app.fileManager.processFrontMatter(file, (frontmatter: Record<string, unknown>) => {
    frontmatter.title = "From native frontmatter";
  });
  await waitForVault(
    () => (titleOf(app, file) === "From native frontmatter" ? true : undefined),
    "native processFrontMatter",
  );
  return {
    before,
    afterProcess,
    processResult: processResult.replace(/^\uFEFF/, ""),
    finalTitle: titleOf(app, file),
  };
}

async function nativeFileFacts(app: VaultHost) {
  const root = "Fidelity native";
  const folder = root + "/Nested";
  const initial = folder + "/Example.md";
  const renamed = folder + "/Renamed.md";
  const trace = observeVault(app, root);
  try {
    const missingFolderRejected = await rejected(() => app.vault.create(initial, "unwritten"));
    await app.vault.createFolder(folder);
    const file = await app.vault.create(initial, "\uFEFF---\ntitle: Native\n---\nBody\n");
    const newCacheIsNull = app.metadataCache.getFileCache(file) === null;
    await waitForCache(app, file);
    const read = await app.vault.read(file);
    const duplicateRejected = await rejected(() => app.vault.create(initial, "unwritten"));
    const edit = await editNativeNote(app, file);

    await app.fileManager.renameFile(file, renamed);
    const renameKeptFile = app.vault.getFileByPath(renamed) === file;
    const oldPathIsGone = app.vault.getFileByPath(initial) === null;
    const trashed: unknown = await app.fileManager.trashFile(file);
    return {
      missingFolderRejected,
      newCacheIsNull,
      read,
      duplicateRejected,
      edit,
      renameKeptFile,
      oldPathIsGone,
      trashReturnedTrue: trashed === true,
      trashRemovedFile: app.vault.getFileByPath(renamed) === null,
      events: trace.events,
    };
  } finally {
    trace.stop();
  }
}

async function brokenYamlFacts(app: VaultHost) {
  const file = await app.vault.create("Fidelity broken.md", "---\ntitle: [\n---\nBody\n");
  const cache = await waitForCache(app, file);
  const section = cache.sections?.find(({ type }) => type === "yaml");
  return {
    hasFrontmatter: cache.frontmatter !== undefined,
    hasFrontmatterPosition: cache.frontmatterPosition !== undefined,
    yamlLines: section ? [section.position.start.line, section.position.end.line] : null,
  };
}

async function fenceFacts(app: VaultHost) {
  return Promise.all(
    FENCE_CASES.map(async (fixture, index) => {
      const text = fenceText(fixture);
      const file = await app.vault.create(`Fidelity fence ${index}.md`, text);
      const cache = await waitForCache(app, file);
      return {
        indexed: cache.frontmatter?.status === "open",
        split: frontmatterYaml(splitNoteText(text)) === "status: open  # keep" + fixture.eol,
      };
    }),
  );
}

export async function vaultFacts(app: VaultHost, api: VaultFunctions) {
  const paths = ["\\a//b\\", "//", "a/.././b", " a\u00a0 /e\u0301 "].map(api.normalizePath);
  return {
    paths,
    yaml: yamlFacts(api),
    writes: await nativeFileFacts(app),
    brokenYaml: await brokenYamlFacts(app),
    fences: await fenceFacts(app),
  };
}

export async function storeScenario(app: VaultHost, probe: NoteStoreProbeApi) {
  const folder = "Fidelity records/Nested";
  const firstName = "Alpha";
  const frontmatter = {
    schema: "product-engineering.item/v1",
    id: "fidelity-store",
    title: "01067",
    status: "open",
    due: "2026-11-22",
  };
  const input = { folder, name: firstName, frontmatter, body: "Body\n" };
  const first = valueOf(await probe.create(input));
  const second = valueOf(await probe.create({ ...input, name: "alpha" }));
  const third = valueOf(await probe.create(input));
  const raw = await app.vault.read(fileAt(app, first.path));
  await Promise.all([first, second, third].map(({ path }) => waitForCache(app, fileAt(app, path))));

  const outside = await app.vault.create(
    "Fidelity outside.md",
    "---\nschema: product-engineering.item/v1\ntitle: Outside\n---\n",
  );
  const unreadable = await app.vault.create(folder + "/Broken.md", "---\nvalue: [\n---\n");
  await Promise.all([waitForCache(app, outside), waitForCache(app, unreadable)]);

  const read = valueOf(await probe.read(first.path));
  const updated = valueOf(await probe.update(first.path, { set: { status: "done" } }));
  const firstFile = fileAt(app, first.path);
  const updatedRaw = await app.vault.process(firstFile, (text) => text);
  await waitForVault(
    () =>
      app.metadataCache.getFileCache(firstFile)?.frontmatter?.status === "done" ? true : undefined,
    "updated record frontmatter",
  );
  const renamed = valueOf(await probe.rename(first.path, "alpha"));
  await waitForCache(app, fileAt(app, renamed.path));
  const taken = await probe.rename(renamed.path, "ALPHA (2)");
  const records = valueOf(await probe.list())
    .map(({ path }) => path)
    .toSorted();
  const broken = valueOf(await probe.unreadable(folder));
  const removed = (await probe.trash(renamed.path)).success;
  const missing = await probe.read(renamed.path);
  return {
    foldersExist: app.vault.getFolderByPath(folder) !== null,
    createdPaths: [first.path, second.path, third.path],
    createdFrontmatter: first.frontmatter,
    raw,
    readFrontmatter: read.frontmatter,
    updatedFrontmatter: updated.frontmatter,
    updatedRaw,
    renamedPath: renamed.path,
    taken,
    records,
    broken,
    removed,
    missing,
  };
}

export async function lineEditScenario(app: VaultHost, probe: NoteStoreProbeApi) {
  const edited = await Promise.all(
    LINE_EDIT_CASES.map(async (fixture) => {
      const file = await app.vault.create(`Fidelity edit ${fixture.name}.md`, fenceText(fixture));
      const cache = await waitForCache(app, file);
      const saved = valueOf(await probe.update(file.path, { set: { status: "done" } }));
      return {
        indexed: cache.frontmatter?.status === "open",
        saved: saved.frontmatter,
        text: await app.vault.process(file, (text) => text),
      };
    }),
  );
  const refusedFile = await app.vault.create(
    "Fidelity refused edit.md",
    fenceText({ closing: "---x", eol: "\n", bom: false }),
  );
  const refused = await probe.update(refusedFile.path, { set: { status: "done" } });
  const keptText = await app.vault.process(refusedFile, (text) => text);
  return { edited, refused, keptText };
}

export function serializerScenario(
  lines: readonly string[],
  parseYaml: VaultFunctions["parseYaml"],
) {
  return lines.map((line) => {
    const parsed = parseYaml(line);
    return yamlSampleValue(
      typeof parsed === "object" && parsed !== null && "probe" in parsed ? parsed.probe : undefined,
    );
  });
}
