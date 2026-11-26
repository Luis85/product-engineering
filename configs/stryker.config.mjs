// @ts-check
import { availableParallelism } from "node:os";

const config = {
  testRunner: "vitest",
  vitest: { configFile: "configs/vitest.stryker.config.ts" },
  checkers: ["typescript"],
  // Individual checks avoid repeatedly traversing the full application graph to group mutants.
  typescriptChecker: { prioritizePerformanceOverAccuracy: false },
  tsconfigFile: "configs/tsconfig.app.json",
  mutate: ["src/domain/**/*.ts", "src/application/**/*.ts"],
  thresholds: { high: 90, low: 80, break: 75 },
  coverageAnalysis: "perTest",
  concurrency: Math.min(12, availableParallelism()),
  incremental: true,
  incrementalFile: "reports/stryker-incremental.json",
  reporters: ["clear-text", "progress", "html", "json"],
  htmlReporter: { fileName: "reports/mutation/index.html" },
  jsonReporter: { fileName: "reports/mutation/mutation.json" },
  ignorePatterns: [
    "/.obsidian-cache",
    "/.obsidian",
    "/.claude",
    "/.fallow",
    "/.probe",
    "/docs",
    "/dist",
    "/release",
    "/coverage",
    "/reports",
    "/harness",
    "/tests/e2e/vaults/reference",
  ],
  tempDirName: ".stryker-tmp",
  cleanTempDir: "always",
};

export default config;
