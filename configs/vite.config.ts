import { readFileSync } from "node:fs";
import { isBuiltin } from "node:module";
import { basename } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, normalizePath } from "vite";
import type { Plugin } from "vite";
import { bundledPackages } from "../scripts/bundled-packages.mjs";
import { sharedConfig, SHELL_ICONS } from "./vite.shared.ts";

const root = fileURLToPath(new URL("../", import.meta.url));
const entry = fileURLToPath(new URL("../src/main.ts", import.meta.url));
const manifest = new URL("../manifest.json", import.meta.url);
const viewRoot =
  normalizePath(fileURLToPath(new URL("../src/presentation", import.meta.url))) + "/";

function isHostExternal(id: string): boolean {
  return /^(obsidian|electron)$|^@(codemirror|lezer)\//.test(id) || isBuiltin(id);
}

function bundleManifest(): Plugin {
  return {
    name: "product-engineering:manifest",
    generateBundle() {
      this.emitFile({
        type: "asset",
        fileName: "manifest.json",
        source: readFileSync(manifest),
      });
    },
  };
}

function authoredSetupName(id: string) {
  if (!id.startsWith(viewRoot) || !/\.vue\?vue&type=script&setup=true(?:&|$)/.test(id)) return;
  return basename(id.slice(0, id.indexOf("?")), ".vue");
}

function omitInferredViewNames(): Plugin {
  const inferred =
    /^(export default \/\*@__PURE__\*\/ _defineComponent\(\{\r?\n)[ \t]*__name: "([^"]+)",\r?\n/m;
  return {
    name: "product-engineering:inferred-view-names",
    enforce: "post",
    transform(code, id) {
      // The setup compiler inserts this filename as the first generated option.
      // Explicit names use a different option and remain available.
      const name = authoredSetupName(id);
      if (name && inferred.exec(code)?.[2] === name) return code.replace(inferred, "$1");
    },
  };
}

export default defineConfig(({ mode }) => {
  const shared = sharedConfig({ mode });
  const development = mode === "development";
  return {
    ...shared,
    // The shipped surface mounts setup-based Vue components.
    define: { ...shared.define, __VUE_OPTIONS_API__: JSON.stringify(development) },
    root,
    publicDir: false,
    plugins: [
      ...shared.plugins,
      ...(mode === "production" ? [omitInferredViewNames()] : []),
      bundleManifest(),
      bundledPackages({ root, icons: SHELL_ICONS, stylesheets: ["src/styles/app.css"] }),
    ],
    build: {
      outDir: "dist",
      emptyOutDir: true,
      target: "es2022",
      minify: !development,
      sourcemap: development ? "inline" : false,
      lib: {
        entry,
        formats: ["cjs"],
        fileName: () => "main.js",
        cssFileName: "styles",
      },
      cssCodeSplit: false,
      rolldownOptions: {
        external: isHostExternal,
        output: { exports: "default", codeSplitting: false },
      },
    },
  };
});
