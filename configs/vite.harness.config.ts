import { fileURLToPath } from "node:url";
import { defineConfig, mergeConfig } from "vite";
import { sharedConfig } from "./vite.shared.ts";

const root = fileURLToPath(new URL("../harness", import.meta.url));

export default defineConfig(({ mode }) =>
  mergeConfig(sharedConfig({ mode, skipScope: (file) => file.endsWith("fake-host.css") }), {
    root,
    base: "./",
    build: {
      outDir: "../reports/harness",
      emptyOutDir: true,
      target: "es2022",
      chunkSizeWarningLimit: 2000,
    },
  }),
);
