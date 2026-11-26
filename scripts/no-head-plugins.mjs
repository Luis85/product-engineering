// @ts-check
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const dist = fileURLToPath(new URL(".", import.meta.resolve("@nuxt/ui/vite")));
const prefix = "\0product-engineering:no-head/";
const noop = "export default { install() {} };";

export const REPLACED = [
  {
    name: "colors",
    path: "runtime/plugins/colors.js",
    sha256: "edb28f0f585d9bd023c36e8297c97f3094a136ddaa5f3ab3d86ed7034422d18d",
  },
  {
    name: "head",
    path: "runtime/vue/plugins/head.js",
    sha256: "01934e8a3dfd7b743ed8f8ec43bf4fd3a80bc16e52662f3e9914f395c263b956",
  },
];

/** @param {(file: string) => Uint8Array} [read] */
export function checkPins(read = readFileSync) {
  for (const { path, sha256 } of REPLACED) {
    const actual = createHash("sha256")
      .update(read(resolve(dist, path)))
      .digest("hex");
    if (actual !== sha256) {
      throw new Error(
        `Nuxt UI's @nuxt/ui/${path} changed. Review the head replacement and update its checksum.`,
      );
    }
  }
}

/**
 * @param {string} source
 * @param {string | undefined} importer
 */
function runtimePath(source, importer) {
  const path = source.split("?")[0] ?? source;
  if (path.startsWith("@nuxt/ui/runtime/")) return path.slice("@nuxt/ui/".length);
  if (isAbsolute(path)) return relative(dist, path).replaceAll("\\", "/");
  if (importer && path.startsWith(".")) {
    return relative(dist, resolve(dirname(importer), path)).replaceAll("\\", "/");
  }
}

export function noHeadPlugins() {
  return {
    name: "product-engineering:no-head",
    enforce: /** @type {const} */ ("pre"),
    buildStart: () => checkPins(),
    /**
     * @param {string} source
     * @param {string} [importer]
     */
    resolveId(source, importer) {
      const path = runtimePath(source, importer);
      const replacement = REPLACED.find((entry) => entry.path === path);
      return replacement ? prefix + replacement.name : null;
    },
    /** @param {string} id */
    load(id) {
      return REPLACED.some(({ name }) => id === prefix + name) ? noop : null;
    },
  };
}
