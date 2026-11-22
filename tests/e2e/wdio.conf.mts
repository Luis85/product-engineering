import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseObsidianVersions } from "wdio-obsidian-service";
import { TEST_LANGUAGE } from "./support";

const rootDir = fileURLToPath(new URL("../../", import.meta.url));
const cacheDir = resolve(rootDir, ".obsidian-cache");
const requestedInstances = Number(process.env.WDIO_MAX_INSTANCES ?? "2");
if (!Number.isSafeInteger(requestedInstances) || requestedInstances < 1) {
  throw new Error("WDIO_MAX_INSTANCES must be a positive integer");
}

const versions = await parseObsidianVersions(process.env.OBSIDIAN_VERSIONS ?? "latest/latest", {
  cacheDir,
});
if (process.env.CI) {
  const cacheKey = versions.map(
    ([appVersion, installerVersion]) => appVersion + "/" + installerVersion,
  );
  process.stdout.write("obsidian-cache-key: " + cacheKey.join(" ") + "\n");
}

export const config: WebdriverIO.Config = {
  rootDir,
  cacheDir,
  runner: "local",
  framework: "mocha",
  tsConfigPath: resolve(rootDir, "tests/e2e/tsconfig.json"),
  specs: ["./tests/e2e/specs/**/*.e2e.ts"],
  maxInstances: requestedInstances,
  capabilities: versions.map(([appVersion, installerVersion]) => ({
    browserName: "obsidian",
    "wdio:obsidianOptions": {
      appVersion,
      installerVersion,
      plugins: ["dist"],
      vault: "tests/e2e/vaults/basic",
      copy: true,
    },
    "goog:chromeOptions": { args: ["--lang=" + TEST_LANGUAGE] },
  })),
  services: ["obsidian"],
  reporters: ["obsidian"],
  mochaOpts: { ui: "bdd", timeout: 60_000 },
  waitforInterval: 250,
  waitforTimeout: 5_000,
  logLevel: "warn",
  outputDir: resolve(rootDir, "reports/e2e"),
  injectGlobals: false,
};
