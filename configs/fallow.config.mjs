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
  const domain = siblings(modules.all, has, "domain");
  const application = siblings(modules.all, has, "application");

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
        { name: "domain", autoDiscover: ["src/domain"], publicFiles: ["index.ts"] },
        { name: "application", autoDiscover: ["src/application"], publicFiles: ["index.ts"] },
        { name: "application-module", patterns: ["src/application/module.ts"] },
        { name: "application-describe-error", patterns: ["src/application/user-messages.ts"] },
        {
          name: "application-composition",
          patterns: compositionFiles.map((file) => `src/application/${file}.ts`),
        },
      ],
      rules: [
        { from: "domain", allow: domain },
        ...(domain.includes("domain/shell") ? [{ from: "domain/shell", allow: [] }] : []),
        {
          from: "application",
          allow: ["domain", ...application, "application-module", "application-composition"],
        },
        { from: "application-module", allowTypeOnly: ["application/shell"] },
        {
          from: "application-describe-error",
          allow: ["application", "application-module", "application-composition"],
        },
        { from: "application-composition", allow: ["domain", "application", "application-module"] },
        {
          from: "application/shell",
          allow: ["application-module", ...domain.filter((zone) => zone === "domain/shell")],
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

/**
 * @param {readonly string[]} modules
 * @param {FallowInput["has"]} has
 * @param {string} layer
 */
function siblings(modules, has, layer) {
  return modules.filter((module) => has(layer, module)).map((module) => `${layer}/${module}`);
}
