// @ts-check
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { parse } from "postcss";

export const PACKAGES_FILE = "reports/bundled-packages.json";

const barePackage = /^((?:@[\w.-]+\/)?[\w][\w.-]*)(?=\/|$)/;
const importTarget = /^(?:url\(\s*)?(?:"([^"]+)"|'([^']+)'|([^\s()]+))/;

/** @param {string} root @param {string} id */
function packageDirectory(root, id) {
  const file = id.split("?")[0];
  if (!file || !isAbsolute(file)) return;
  const parts = relative(root, file).replaceAll("\\", "/").split("/");
  if (parts[0] !== "node_modules") return;
  const start = parts.lastIndexOf("node_modules") + 1;
  const first = parts[start];
  if (!first || first.startsWith(".")) return;
  return parts.slice(0, start + (first.startsWith("@") ? 2 : 1)).join("/");
}

/** @param {string} root @param {string} directory */
function packageManifest(root, directory) {
  /** @type {unknown} */
  const manifest = JSON.parse(readFileSync(join(root, directory, "package.json"), "utf8"));
  if (
    manifest &&
    typeof manifest === "object" &&
    "name" in manifest &&
    typeof manifest.name === "string"
  ) {
    const style =
      "style" in manifest && typeof manifest.style === "string" ? manifest.style : undefined;
    return { name: manifest.name, style };
  }
  throw new Error(`Missing package name in ${directory}/package.json`);
}

/** @param {string} root @param {string} name @param {string} importer */
function installedDirectory(root, name, importer) {
  let search = dirname(importer);
  while (!relative(root, search).startsWith("..")) {
    const path = join(search, "node_modules", name);
    if (existsSync(join(path, "package.json"))) return relative(root, path).replaceAll("\\", "/");
    if (search === root) break;
    search = dirname(search);
  }
  throw new Error(`Cannot locate the bundled package ${name}`);
}

/** @param {string} file */
function cssImports(file) {
  /** @type {string[]} */
  const imports = [];
  parse(readFileSync(file, "utf8"), { from: file }).walkAtRules("import", ({ params }) => {
    const match = importTarget.exec(params);
    const target = match?.[1] ?? match?.[2] ?? match?.[3];
    if (target) imports.push(target);
  });
  return imports;
}

/** @param {string} root @param {string} stylesheet @param {string} target */
function stylesheetImport(root, stylesheet, target) {
  const local = resolve(dirname(stylesheet), target);
  if (existsSync(local)) return { file: local };

  const name = barePackage.exec(target)?.[1];
  if (!name) return {};
  const directory = installedDirectory(root, name, stylesheet);
  const path = target.slice(name.length + 1) || packageManifest(root, directory).style;
  if (!path) return { directory };
  const file = join(root, directory, path);
  return file.endsWith(".css") && existsSync(file) ? { directory, file } : { directory };
}

/** @param {string} root @param {readonly string[]} stylesheets @param {Set<string>} packages */
function addStylesheetPackages(root, stylesheets, packages) {
  const remaining = stylesheets.map((stylesheet) => resolve(root, stylesheet));
  /** @type {Set<string>} */
  const visited = new Set();
  for (const stylesheet of remaining) {
    if (visited.has(stylesheet)) continue;
    visited.add(stylesheet);
    const owner = packageDirectory(root, stylesheet);
    if (owner) packages.add(owner);
    for (const target of cssImports(stylesheet)) {
      const { directory, file } = stylesheetImport(root, stylesheet, target);
      if (directory) packages.add(directory);
      if (file) remaining.push(file);
    }
  }
}

/** @param {string} file */
function sha256(file) {
  return createHash("sha256").update(readFileSync(file)).digest("hex");
}

/** @param {string} left @param {string} right */
function compare(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

/**
 * @param {{root: string, icons: readonly string[], stylesheets: readonly string[]}} options
 * @returns {import("vite").Plugin}
 */
export function bundledPackages({ root: inputRoot, icons, stylesheets }) {
  const root = realpathSync.native(inputRoot);
  return {
    name: "product-engineering:bundled-packages",
    apply: (_config, { command, mode }) => command === "build" && mode === "production",
    writeBundle(output, bundle) {
      const rendered = Object.values(bundle).flatMap((entry) =>
        entry.type === "chunk"
          ? Object.entries(entry.modules).flatMap(([id, module]) =>
              module.renderedLength ? [id] : [],
            )
          : [],
      );
      /** @type {Set<string>} */
      const directories = new Set();
      for (const id of rendered) {
        const directory = packageDirectory(root, id);
        if (directory) directories.add(directory);
      }
      if (rendered.some((id) => id.endsWith("virtual:nuxt-ui-icons"))) {
        for (const icon of icons) {
          const [collection] = icon.split(":");
          directories.add(
            installedDirectory(root, `@iconify-json/${collection}`, join(root, "package.json")),
          );
        }
      }
      addStylesheetPackages(root, stylesheets, directories);
      const packages = [...directories]
        .map((directory) => ({
          name: packageManifest(root, directory).name,
          directory,
        }))
        .toSorted((a, b) => compare(a.name, b.name) || compare(a.directory, b.directory));
      const outDir = resolve(root, output.dir ?? dirname(output.file ?? "dist/main.js"));
      const report = {
        sha256: sha256(join(outDir, "main.js")),
        stylesSha256: sha256(join(outDir, "styles.css")),
        packages,
      };
      const target = join(root, PACKAGES_FILE);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, JSON.stringify(report, null, 2) + "\n");
    },
  };
}
