import {
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmdirSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { CSS_PREFIX as BUILD_CSS_PREFIX, PLUGIN_ID } from "../../../configs/vite.shared";
import { BUDGETS, checkDist, CSS_PREFIX, EXPECTED_FILES } from "../../../scripts/check-dist.mjs";
import { installDevArtifacts } from "../../../scripts/dev-install.mjs";
import manifest from "../../../manifest.json";

const identity = { id: manifest.id, prefix: CSS_PREFIX };
const scope = ".product-engineering-root";
const bundle = `
  const host = require("obsidian");
  const electron = require('electron');
  const node = require("node:fs/promises");
  const system = require("path");
  const editor = require("@codemirror/state");
  const parser = require("@lezer/common");
  module.exports = class Plugin {};
`;

const stylesheet = `
  ${scope}, ${scope}.dark { color: red }
  @media (forced-colors: active) {
    ${scope} > button { outline: 1px solid }
  }
  @keyframes pe-spin { to { transform: rotate(360deg) } }
  @property --pe-scale { syntax: "<number>"; initial-value: 1; inherits: false }
`;

const temporaryDirectories = new Set<string>();

function temporaryDirectory() {
  const dir = mkdtempSync(join(tmpdir(), "product-engineering-dist-"));
  temporaryDirectories.add(dir);
  return dir;
}

function distribution(files: Record<string, string> = {}) {
  const dir = temporaryDirectory();
  const contents = {
    "main.js": bundle,
    "manifest.json": JSON.stringify(manifest),
    "styles.css": stylesheet,
    ...files,
  };
  for (const [name, contentsForFile] of Object.entries(contents)) {
    writeFileSync(join(dir, name), contentsForFile);
  }
  return dir;
}

afterEach(() => {
  for (const dir of temporaryDirectories) {
    for (const name of readdirSync(dir)) unlinkSync(join(dir, name));
    rmdirSync(dir);
  }
  temporaryDirectories.clear();
});

describe("distribution checks", () => {
  it("uses the same plugin identity and CSS prefix as the build", () => {
    expect(manifest.id).toBe(PLUGIN_ID);
    expect(CSS_PREFIX).toBe(BUILD_CSS_PREFIX);
  });

  it("accepts a CommonJS bundle, permitted externals, and scoped CSS", () => {
    const dist = distribution();
    expect(readdirSync(dist).toSorted()).toEqual([...EXPECTED_FILES].toSorted());
    expect(checkDist(dist, manifest, identity)).toEqual([]);
  });

  it("reports both missing and extra files", () => {
    const dist = distribution({ "extra.js": "void 0" });
    unlinkSync(join(dist, "styles.css"));
    const failures = checkDist(dist, manifest, identity);
    expect(failures).toContainEqual(expect.stringMatching(/missing.*styles\.css/i));
    expect(failures).toContainEqual(expect.stringMatching(/unexpected.*extra\.js/i));
  });

  it("rejects a manifest different from the root manifest", () => {
    const dist = distribution({
      "manifest.json": JSON.stringify({ ...manifest, version: "9.9.9" }),
    });
    expect(checkDist(dist, manifest, identity)).toContainEqual(
      expect.stringMatching(/manifest\.json.*root manifest/i),
    );
  });

  it("requires an actual CommonJS export assignment", () => {
    const dist = distribution({
      "main.js": "// module.exports = 1\nexport default class Plugin {}",
    });
    expect(checkDist(dist, manifest, identity)).toContainEqual(
      expect.stringMatching(/main\.js.*module\.exports/i),
    );
  });

  it.each([
    ['require("vue");', /require.*vue/i],
    ['fetch("https://example.invalid/plugin");', /fetch.*https:\/\//i],
    ['xhr.open("GET", "http://example.invalid/plugin");', /open.*http:\/\//i],
    ['window.open("https://example.invalid/help");', /open.*https:\/\//i],
    ['const testOnly = "product-engineering/test-only";', /test-only/i],
  ])("rejects forbidden bundle code %s", (line, diagnostic) => {
    const dist = distribution({ "main.js": bundle + line });
    expect(checkDist(dist, manifest, identity)).toContainEqual(expect.stringMatching(diagnostic));
  });

  it.each([
    [`${scope} a, body { color: red }`, /unscoped.*body/i],
    [`${scope} + .sidebar { color: red }`, /unscoped.*sidebar/i],
    ["@layer base, utilities;", /@layer/i],
    ["@keyframes move { to { color: red } }", /@keyframes.*move/i],
    [
      "@property --tw-size { syntax: '<length>'; initial-value: 0px; inherits: false }",
      /@property.*--tw-size/i,
    ],
  ])("rejects styles that escape the plugin scope in %s", (css, diagnostic) => {
    const dist = distribution({ "styles.css": stylesheet + css });
    expect(checkDist(dist, manifest, identity)).toContainEqual(expect.stringMatching(diagnostic));
  });

  it("enforces both byte budgets", () => {
    const dist = distribution({
      "main.js": bundle + "//" + "x".repeat(BUDGETS["main.js"]),
      "styles.css": stylesheet + "/*" + "ä".repeat(BUDGETS["styles.css"] / 2) + "*/",
    });
    const failures = checkDist(dist, manifest, identity);
    expect(failures).toContainEqual(expect.stringMatching(/main\.js.*byte budget/i));
    expect(failures).toContainEqual(expect.stringMatching(/styles\.css.*byte budget/i));
  });
});

describe("development install", () => {
  it("installs only the build artifacts and leaves unrelated files in place", () => {
    const dist = distribution({ "report.txt": "build output from another tool" });
    const target = temporaryDirectory();
    writeFileSync(join(target, "data.json"), '{"logLevel":"debug"}');

    installDevArtifacts(dist, target);

    expect(readdirSync(target).toSorted()).toEqual(
      [...EXPECTED_FILES, ".hotreload", "data.json"].toSorted(),
    );
    expect(readFileSync(join(target, "main.js"), "utf8")).toBe(bundle);
    expect(readFileSync(join(target, "styles.css"), "utf8")).toBe(stylesheet);
    expect(readFileSync(join(target, "manifest.json"), "utf8")).toBe(JSON.stringify(manifest));
    expect(readFileSync(join(target, "data.json"), "utf8")).toBe('{"logLevel":"debug"}');
  });

  it("leaves the target untouched when the completed build is incomplete", () => {
    const dist = distribution();
    unlinkSync(join(dist, "styles.css"));
    const target = temporaryDirectory();
    writeFileSync(join(target, "main.js"), "previous build");

    expect(() => installDevArtifacts(dist, target)).toThrow(/styles\.css/);
    expect(readdirSync(target)).toEqual(["main.js"]);
    expect(readFileSync(join(target, "main.js"), "utf8")).toBe("previous build");
  });
});
