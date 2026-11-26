import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
import { BUDGETS } from "../../../scripts/check-dist.mjs";
import { packageRelease, RELEASE_FILES } from "../../../scripts/package-release.mjs";

const manifest = {
  id: "product-engineering",
  name: "Product Engineering",
  version: "0.1.0",
  minAppVersion: "1.15.1",
};
const notices = "Example dependency notices\n";
const files = {
  "main.js": "/*!\nExample dependency notices\n*/\nmodule.exports = class Plugin {};\n",
  "manifest.json": JSON.stringify(manifest) + "\n",
  "styles.css": ".product-engineering-root { color: red }\n",
};
const noticeName = "THIRD-PARTY-NOTICES.txt";
const temporary = new Set<string>();

function fixture() {
  const rootDir = mkdtempSync(join(tmpdir(), "product-engineering-package-"));
  temporary.add(rootDir);
  const distDir = join(rootDir, "dist");
  const outDir = join(rootDir, "release");
  mkdirSync(distDir);
  for (const [name, text] of Object.entries(files)) writeFileSync(join(distDir, name), text);
  writeFileSync(join(rootDir, "manifest.json"), files["manifest.json"]);
  writeFileSync(join(rootDir, "versions.json"), JSON.stringify({ "0.1.0": "1.15.1" }));
  writeFileSync(join(rootDir, noticeName), notices);
  return { rootDir, distDir, outDir };
}

afterEach(() => {
  for (const dir of temporary) rmSync(dir, { recursive: true, force: true });
  temporary.clear();
});

it("stages exactly the three loadable files and keeps notices beside them", () => {
  const input = fixture();
  const packaged = packageRelease({ ...input, tag: "0.1.0" });
  const plugin = join(input.outDir, manifest.id);
  expect(packaged).toEqual({
    pluginDirectory: plugin,
    noticesFile: join(input.outDir, noticeName),
  });
  expect(readdirSync(plugin).toSorted()).toEqual([...RELEASE_FILES].toSorted());
  expect(readdirSync(input.outDir).toSorted()).toEqual([manifest.id, noticeName].toSorted());
  for (const [name, text] of Object.entries(files)) {
    expect(readFileSync(join(plugin, name), "utf8")).toBe(text);
  }
  expect(readFileSync(packaged.noticesFile, "utf8")).toBe(notices);
});

it("refuses to package a bundle that omits the third-party notice header", () => {
  const input = fixture();
  writeFileSync(join(input.distDir, "main.js"), "module.exports = class Plugin {};\n");
  expect(() => packageRelease(input)).toThrow(/embed.*third-party notices/i);
  expect(existsSync(join(input.outDir, manifest.id))).toBe(false);
});

it("replaces an existing staged build when both input and output are valid", () => {
  const input = fixture();
  const { pluginDirectory, noticesFile } = packageRelease(input);
  writeFileSync(join(pluginDirectory, "main.js"), "previous package");
  writeFileSync(noticesFile, "previous notices");
  packageRelease(input);
  expect(readFileSync(join(pluginDirectory, "main.js"), "utf8")).toBe(files["main.js"]);
  expect(readFileSync(noticesFile, "utf8")).toBe(notices);
  expect(readdirSync(input.outDir)).toHaveLength(2);
});

it.each([
  ["v0.1.0", /plain.*version/i],
  ["0.1.1", /tag.*manifest/i],
])("refuses release tag %s before creating the output", (tag, message) => {
  const input = fixture();
  expect(() => packageRelease({ ...input, tag })).toThrow(message);
  expect(existsSync(input.outDir)).toBe(false);
});

it.each([
  ["missing version", { "0.0.9": "1.15.1" }],
  ["wrong minimum", { "0.1.0": "1.14.4" }],
])("refuses %s in versions.json", (_, versions) => {
  const input = fixture();
  writeFileSync(join(input.rootDir, "versions.json"), JSON.stringify(versions));
  expect(() => packageRelease(input)).toThrow(/versions\.json/);
});

it.each(["missing", "whitespace only"])("refuses a notices file that is %s", (state) => {
  const input = fixture();
  const path = join(input.rootDir, noticeName);
  if (state === "missing") unlinkSync(path);
  else writeFileSync(path, " \n\t");
  expect(() => packageRelease(input)).toThrow(/THIRD-PARTY-NOTICES\.txt/);
  expect(existsSync(input.outDir)).toBe(false);
});

it("rejects an older dist manifest and a development bundle through check:dist invariants", () => {
  const input = fixture();
  const deployed = join(input.distDir, "manifest.json");
  writeFileSync(deployed, JSON.stringify({ ...manifest, version: "0.0.9" }));
  expect(() => packageRelease(input)).toThrow(/differs from the root manifest/);
  writeFileSync(deployed, files["manifest.json"]);
  writeFileSync(join(input.distDir, "main.js"), " ".repeat(BUDGETS["main.js"] + 1));
  expect(() => packageRelease(input)).toThrow(/main\.js exceeds/);
});

it("preserves an earlier release if the new distribution is incomplete", () => {
  const input = fixture();
  const { pluginDirectory, noticesFile } = packageRelease(input);
  unlinkSync(join(input.distDir, "styles.css"));
  expect(() => packageRelease(input)).toThrow(/Missing build file styles\.css/);
  expect(readFileSync(join(pluginDirectory, "styles.css"), "utf8")).toBe(files["styles.css"]);
  expect(readFileSync(noticesFile, "utf8")).toBe(notices);
});

it("preserves an existing plugin installation with its own data file", () => {
  const input = fixture();
  const plugin = join(input.outDir, manifest.id);
  mkdirSync(plugin, { recursive: true });
  const personalData = join(plugin, "data.json");
  writeFileSync(personalData, "{}\n");
  expect(() => packageRelease(input)).toThrow(/Unexpected release file data\.json/);
  expect(readFileSync(personalData, "utf8")).toBe("{}\n");
});
