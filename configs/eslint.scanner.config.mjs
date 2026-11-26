// @ts-check
import { execFileSync } from "node:child_process";
import { closeSync, lstatSync, openSync, readSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, globalIgnores } from "eslint/config";
import obsidianmd from "eslint-plugin-obsidianmd";
import tseslint from "typescript-eslint";

const root = fileURLToPath(new URL("../", import.meta.url));
const javascriptFiles = ["**/*.{js,cjs,mjs,jsx}"];
const typescriptFiles = ["**/*.{ts,cts,mts,tsx}"];
const bundleBanner = /\b(?:bundled|generated)(?:\s*\/\s*bundled)?(?:\s+file)?\s+by\b/i;

/** @param {...string} flags */
function gitFiles(...flags) {
  return execFileSync("git", ["ls-files", "-z", ...flags], { cwd: root, encoding: "utf8" })
    .split("\0")
    .filter(Boolean);
}

/** @param {string} file */
function literalIgnore(file) {
  return file.replaceAll(/[\\!#*?[\]{}()+@]/g, "\\$&");
}

/** @param {string} path */
function readHeader(path) {
  if (!lstatSync(path, { throwIfNoEntry: false })?.isFile()) return Buffer.alloc(0);
  const descriptor = openSync(path, "r");
  try {
    const bytes = Buffer.alloc(500);
    const size = readSync(descriptor, bytes, 0, bytes.length, 0);
    return bytes.subarray(0, size);
  } finally {
    closeSync(descriptor);
  }
}

/** @param {Buffer} header */
function looksBundled(header) {
  const text = header.toString("utf8");
  const breaks = Array.from(text.matchAll(/\r\n|[\r\n]/g)).length;
  return bundleBanner.test(text) || (header.length === 500 && breaks < 2);
}

/** @param {string} file */
function isBundle(file) {
  return (
    !file.startsWith("src/") && file.endsWith(".js") && looksBundled(readHeader(join(root, file)))
  );
}

const checkoutIgnores = [
  ...gitFiles("--others", "--directory"),
  ...gitFiles("--cached").filter(isBundle),
].map(literalIgnore);

// Local preview of the community scanner configuration documented for obsidianmd 0.6.0.
export default defineConfig([
  {
    languageOptions: { parserOptions: { projectService: true, tsconfigRootDir: root } },
  },
  ...obsidianmd.configs.recommended,
  {
    files: [...typescriptFiles, ...javascriptFiles],
    rules: {
      "no-eval": "error",
      "no-unsanitized/method": "error",
      "no-unsanitized/property": "error",
      "obsidianmd/regex-lookbehind": "error",
      "obsidianmd/no-forbidden-elements": "error",
      "no-undef": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-argument": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-return": "off",
      "@typescript-eslint/restrict-template-expressions": "off",
      "@typescript-eslint/no-base-to-string": "off",
      "import/no-unresolved": "off",
      "obsidianmd/commands/no-command-in-command-id": "off",
      "obsidianmd/commands/no-plugin-id-in-command-id": "off",
    },
  },
  { files: javascriptFiles, rules: { "no-implied-eval": "error" } },
  { files: typescriptFiles, rules: { "@typescript-eslint/no-implied-eval": "error" } },
  {
    files: javascriptFiles,
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: { parserOptions: { projectService: false, project: null } },
    rules: Object.fromEntries(
      Object.keys(obsidianmd.ruleConfigs.recommendedTypeChecked).map(
        (rule) => /** @type {const} */ ([rule, "off"]),
      ),
    ),
  },
  { files: ["manifest.json"], rules: { "obsidianmd/validate-manifest": "off" } },
  {
    files: ["LICENSE", "LICENSE.md", "LICENSE.txt"],
    rules: { "obsidianmd/validate-license": "off" },
  },
  { linterOptions: { reportUnusedDisableDirectives: "off", reportUnusedInlineConfigs: "off" } },
  globalIgnores([
    ...checkoutIgnores,
    "main.js",
    "**/*.min.js",
    "**/{dist,build,out,release}/**/*.{js,cjs,mjs,jsx}",
    "node_modules",
    "dist",
    "build",
    "pkg",
    "test-vault",
    ".obsidian",
    "**/.obsidian/**",
    "esbuild.config.mjs",
    "version-bump.mjs",
    "**/*.test.*",
    "**/*.tests.*",
    "**/*.spec.*",
    "**/*.specs.*",
    "**/test/**",
    "**/tests/**",
    "**/__tests__/**",
    "**/mocks/**",
    "**/__mocks__/**",
    "**/*.cjs",
    "**/*.mjs",
    "**/*.cts",
    "**/*.mts",
    "**/vite*",
    "**/scripts/**",
    "**/docs/**",
    "**/i18n/**",
    "**/i18next/**",
    "**/locale/**",
    "**/locales/**",
    "**/translations/**",
    "**/l10n/**",
    ".pnpm-store",
    "**/*.spec.ts",
    "**/testUtils**",
    "automation/**",
    "**/e2e/**",
    "**/e2e-tests/**",
    "**/*.e2e.*",
    "**/wdio.conf.*",
    "**/wdio.*.conf.*",
    "**/playwright.config.*",
    "**/{astro,babel,commitlint,docusaurus,esbuild,eslint,jest,oxlint,postcss,prettier,rolldown,rollup,stylelint,svelte,tailwind,tsdown,tsup,uno,webpack}.config.*",
    "**/{eslint,jest}.*.config.*",
    "**/jest.setup.*",
    "**/.{babelrc,eslintrc,mocharc,prettierrc}.*",
  ]),
]);
