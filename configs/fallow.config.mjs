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
  const integrationPorts = application.filter((zone) => zone === "application/integrations");
  const presentation = siblings(modules.all, has, "presentation").filter(
    (zone) => zone !== "presentation/shell",
  );
  const adapters = modules.all
    .filter((module) => has("infrastructure/obsidian", module))
    .map((module) => `adapters/${module}`);
  const nodeAdapters = ["mcp", "provider-cli"]
    .filter((module) => has("infrastructure", module))
    .map((module) => {
      const directory = `src/infrastructure/${module}`;
      return {
        name: `node-adapters/${module}`,
        patterns: [`${directory}/**`],
        publicFiles: [`${directory}/index.ts`],
      };
    });

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
        {
          name: "adapters",
          autoDiscover: ["src/infrastructure/obsidian"],
          publicFiles: ["index.ts"],
        },
        ...nodeAdapters,
        { name: "infrastructure", patterns: ["src/infrastructure/**"] },
        {
          name: "presentation/shell",
          patterns: ["src/presentation/shell/**"],
          publicFiles: [
            "src/presentation/shell/index.ts",
            "src/presentation/shell/host.ts",
            "src/presentation/shell/screens.ts",
          ],
        },
        ...(presentation.length > 0
          ? [
              {
                name: "presentation",
                autoDiscover: ["src/presentation"],
                publicFiles: ["index.ts", "screens.ts"],
              },
            ]
          : []),
        { name: "presentation-composition", patterns: ["src/presentation/app-surface.ts"] },
        { name: "composition", patterns: ["src/main.ts", "src/bootstrap.ts"] },
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
        {
          from: "adapters",
          allow: [
            ...adapters,
            "infrastructure",
            "application",
            "application-composition",
            "domain",
            "presentation/shell",
          ],
        },
        {
          from: "infrastructure",
          allow: ["adapters", "application", "application-composition", "domain"],
        },
        ...nodeAdapters.map(({ name }) => ({ from: name, allow: integrationPorts })),
        ...(adapters.includes("adapters/integrations")
          ? [
              {
                from: "adapters/integrations",
                allow: [
                  "adapters/shell",
                  "application/integrations",
                  "application/shell",
                  "application-describe-error",
                  "application-composition",
                  "domain/shell",
                ],
              },
            ]
          : []),
        ...(presentation.length > 0
          ? [
              {
                from: "presentation",
                allow: [
                  ...presentation,
                  "presentation/shell",
                  "application",
                  "application-composition",
                  "application-describe-error",
                  "domain",
                ],
              },
            ]
          : []),
        {
          from: "presentation/shell",
          allow: ["application/shell", "application-describe-error", "domain/shell"],
          allowTypeOnly: ["application-composition"],
        },
        {
          from: "presentation-composition",
          allow: [
            "presentation/shell",
            ...presentation,
            "application",
            "application-composition",
            "domain",
          ],
        },
        {
          from: "composition",
          allow: [
            "infrastructure",
            "adapters",
            "application",
            "application-composition",
            "domain",
            "presentation/shell",
            "presentation-composition",
            ...nodeAdapters.map(({ name }) => name),
          ],
        },
        ...(adapters.includes("adapters/shell")
          ? [
              {
                from: "adapters/shell",
                allow: [
                  "infrastructure",
                  "application/shell",
                  "application-composition",
                  "domain/shell",
                  "presentation/shell",
                ],
              },
            ]
          : []),
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
    ignoreDependencies: ["obsidian", "@eslint/js", "@iconify-json/lucide"],
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
