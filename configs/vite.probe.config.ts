import { readFileSync } from "node:fs";
import { isBuiltin } from "node:module";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import type { Plugin } from "vite";

const root = fileURLToPath(new URL("../", import.meta.url));
const probe = new URL("../tests/e2e/probe-plugin/", import.meta.url);
const entry = fileURLToPath(new URL("main.ts", probe));
const manifest = new URL("manifest.json", probe);

function probeManifest(): Plugin {
  return {
    name: "note-store-probe:manifest",
    generateBundle() {
      this.emitFile({ type: "asset", fileName: "manifest.json", source: readFileSync(manifest) });
    },
  };
}

function isHostExternal(id: string): boolean {
  return /^(obsidian|electron)$|^@(codemirror|lezer)\//.test(id) || isBuiltin(id);
}

export default defineConfig({
  root,
  publicDir: false,
  plugins: [probeManifest()],
  build: {
    outDir: fileURLToPath(new URL("dist/", probe)),
    emptyOutDir: true,
    target: "es2022",
    lib: {
      entry,
      formats: ["cjs"],
      fileName: () => "main.js",
    },
    rolldownOptions: {
      external: isHostExternal,
      output: { exports: "default", codeSplitting: false },
    },
  },
});
