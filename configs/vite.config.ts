import { readFileSync } from "node:fs";
import { isBuiltin } from "node:module";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import type { Plugin } from "vite";
import { bundledPackages } from "../scripts/bundled-packages.mjs";
import { sharedConfig, SHELL_ICONS } from "./vite.shared.ts";

const root = fileURLToPath(new URL("../", import.meta.url));
const entry = fileURLToPath(new URL("../src/main.ts", import.meta.url));
const manifest = new URL("../manifest.json", import.meta.url);

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

export default defineConfig(({ mode }) => {
  const shared = sharedConfig({ mode });
  const development = mode === "development";
  return {
    ...shared,
    root,
    publicDir: false,
    plugins: [
      ...shared.plugins,
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
