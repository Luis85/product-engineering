// @ts-check
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { EXPECTED_FILES } from "./check-dist.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));

/** @param {string} dist @param {string} target */
export function installDevArtifacts(dist, target) {
  // Read the complete build before touching a plugin installation.
  const files = EXPECTED_FILES.map((name) => ({ name, data: readFileSync(join(dist, name)) }));
  mkdirSync(target, { recursive: true });
  for (const { name, data } of files) writeFileSync(join(target, name), data);
  writeFileSync(join(target, ".hotreload"), "");
}

async function dev() {
  const envFile = join(root, ".env.local");
  if (existsSync(envFile)) process.loadEnvFile(envFile);
  const configuredTarget = process.env.OBSIDIAN_PLUGIN_DIR;
  const { build } = await import("vite");
  const configFile = join(root, "configs/vite.config.ts");

  if (!configuredTarget) {
    await build({ configFile, mode: "development" });
    console.log("Set OBSIDIAN_PLUGIN_DIR in .env.local to watch and install builds automatically.");
    return;
  }

  const target = resolve(root, configuredTarget);
  const dist = join(root, "dist");
  await build({
    configFile,
    mode: "development",
    build: { watch: {} },
    plugins: [
      {
        name: "product-engineering:dev-install",
        writeBundle() {
          installDevArtifacts(dist, target);
          console.log("Installed the development build in " + target);
        },
      },
    ],
  });
}

const entry = process.argv[1];
if (entry && pathToFileURL(entry).href === import.meta.url) {
  try {
    await dev();
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
}
