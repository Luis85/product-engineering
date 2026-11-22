// @ts-check
import oxlint from "../.oxlintrc.json" with { type: "json" };

/**
 * @typedef {{
 *   modules: ReturnType<typeof import("../scripts/modules.mjs").readModules>,
 *   has: (folder: string, module: string) => boolean
 * }} FallowInput
 */

const compositionFiles = [
  "modules",
  "errors",
  "events",
  "app-services",
  "app-services-layer",
  "messages",
  "routes",
  "note-types",
  "commands",
];

/** @param {FallowInput} input */
export function fallowConfig({ modules, has }) {
  const siblings = modules.all
    .filter((module) => has("application", module))
    .map((module) => `application/${module}`);

  return {
    $schema: "../node_modules/fallow/schema.json",
    entry: [],
    supportEntry: [
      "scripts/*.mjs",
      "tests/**/*.test.ts",
      "tests/e2e/**/*.ts",
      "tests/e2e/wdio.conf.mts",
      "configs/*.ts",
      "configs/*.mjs",
      "*.config.mjs",
    ],
    ignorePatterns: oxlint.ignorePatterns,
    duplicates: { minTokens: 50 },
    health: { maxCyclomatic: 10 },
    boundaries: {
      zones: [
        { name: "application", autoDiscover: ["src/application"], publicFiles: ["index.ts"] },
        { name: "application-module", patterns: ["src/application/module.ts"] },
        {
          name: "application-composition",
          patterns: compositionFiles.map((file) => `src/application/${file}.ts`),
        },
      ],
      rules: [
        {
          from: "application",
          allow: [...siblings, "application-module", "application-composition"],
        },
        { from: "application-module", allowTypeOnly: ["application/shell"] },
        { from: "application-composition", allow: ["application", "application-module"] },
        {
          from: "application/shell",
          allow: ["application-module"],
          allowTypeOnly: ["application-composition"],
        },
      ],
      coverage: {
        requireAllFiles: true,
        allowUnmatched: [
          "src/env.d.ts",
          "src/styles/**",
          "tests/**",
          "scripts/**",
          "harness/**",
          "configs/**",
          "*.mjs",
        ],
      },
    },
    ignoreDependencies: ["obsidian", "@eslint/js"],
    overrides: [{ files: ["tests/support/obsidian/**"], rules: { "unused-class-members": "off" } }],
  };
}
