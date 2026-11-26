// @ts-check
import inner from "./stryker.config.mjs";

export default {
  ...inner,
  vitest: { configFile: "configs/vitest.stryker.edge.config.ts" },
  // The informational edge report measures runtime behavior.
  checkers: [],
  mutate: [
    "src/infrastructure/obsidian/**/*.ts",
    "src/infrastructure/memory/**/*.ts",
    "src/presentation/**/*.ts",
    "src/bootstrap.ts",
  ],
  thresholds: { high: 90, low: 80, break: null },
  // Both projects take nearly seven minutes with one Vitest worker on Windows.
  dryRunTimeoutMinutes: 15,
  incrementalFile: "reports/stryker-edge-incremental.json",
  htmlReporter: { fileName: "reports/mutation-edge/index.html" },
  jsonReporter: { fileName: "reports/mutation-edge/mutation.json" },
  // The edge projects also run the tests that import the harness layer.
  ignorePatterns: inner.ignorePatterns.filter((pattern) => pattern !== "/harness"),
};
