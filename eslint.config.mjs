import { fileURLToPath } from "node:url";
import obsidianmd from "eslint-plugin-obsidianmd";
import oxlint from "eslint-plugin-oxlint";
import vue from "eslint-plugin-vue";
import globals from "globals";
import tseslint from "typescript-eslint";
import vueParser from "vue-eslint-parser";

const root = fileURLToPath(new URL(".", import.meta.url));
const project = ["./configs/tsconfig.app.json", "./configs/tsconfig.node.json"];
const typeAware = { project, tsconfigRootDir: root, extraFileExtensions: [".vue"] };
const obsidianRules = obsidianmd.configs.recommended;
const obsidianVueRules = obsidianRules
  .filter(({ files }) => files?.length === 1 && files[0] === "**/*.{ts,cts,mts,tsx}")
  .map(({ ignores, plugins, rules }) => ({
    files: ["**/*.vue"],
    ...(ignores && { ignores }),
    plugins: Object.fromEntries(
      Object.entries(plugins ?? {}).filter(([name]) =>
        ["no-unsanitized", "@microsoft/sdl"].includes(name),
      ),
    ),
    rules: Object.fromEntries(
      Object.entries(rules ?? {}).filter(
        ([name]) =>
          name.startsWith("obsidianmd/") ||
          name.startsWith("no-unsanitized/") ||
          name === "@microsoft/sdl/no-inner-html",
      ),
    ),
  }));

export default [
  {
    ignores: [
      "docs/**",
      "dist/**",
      "release/**",
      "reports/**",
      ".stryker-tmp/**",
      ".obsidian-cache/**",
      ".obsidian/**",
      ".claude/**",
      ".fallow/**",
      ".probe/**",
      "node_modules/**",
      "**/dist/**",
    ],
  },
  ...obsidianRules,
  {
    files: ["**/*.{ts,mts,mjs}"],
    languageOptions: { parserOptions: typeAware },
  },
  ...vue.configs["flat/recommended"].map((config) => ({ ...config, files: ["**/*.vue"] })),
  {
    files: ["**/*.vue"],
    languageOptions: {
      parser: vueParser,
      parserOptions: { ...typeAware, parser: tseslint.parser },
    },
    plugins: { "@typescript-eslint": tseslint.plugin },
    rules: {
      "vue/attributes-order": "off",
      "vue/first-attribute-linebreak": "off",
      "vue/html-closing-bracket-newline": "off",
      "vue/html-closing-bracket-spacing": "off",
      "vue/html-indent": "off",
      "vue/html-quotes": "off",
      "vue/html-self-closing": "off",
      "vue/max-attributes-per-line": "off",
      "vue/multiline-html-element-content-newline": "off",
      "vue/mustache-interpolation-spacing": "off",
      "vue/no-multi-spaces": "off",
      "vue/singleline-html-element-content-newline": "off",
      "vue/no-v-html": "error",
    },
  },
  ...obsidianVueRules,
  {
    files: ["**/*.{ts,mts,vue}"],
    rules: {
      "@typescript-eslint/switch-exhaustiveness-check": [
        "error",
        { considerDefaultExhaustiveForUnions: false },
      ],
    },
  },
  {
    files: ["src/**/*.{ts,vue}"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "MemberExpression[object.name='process']:matches([property.name='env'], [property.value='env'])",
          message: "Read plugin configuration through application settings.",
        },
        {
          selector:
            "MemberExpression[object.object.type='MetaProperty'][object.object.meta.name='import'][object.object.property.name='meta']:matches([object.property.name='env'], [object.property.value='env']):not([computed=false][property.name='MODE']):not([computed=true][property.value='MODE'])",
          message: "Only import.meta.env.MODE is available in plugin source.",
        },
      ],
    },
  },
  {
    files: ["scripts/**/*.mjs", "configs/**/*.{ts,mjs}", "*.config.mjs"],
    languageOptions: { globals: globals.node },
  },
  {
    files: ["harness/**"],
    rules: { "obsidianmd/prefer-active-doc": "off", "obsidianmd/prefer-create-el": "off" },
  },
  {
    files: ["**/*.{ts,vue,mjs}"],
    ignores: ["tests/**"],
    rules: { "max-lines": ["error", { max: 400, skipBlankLines: true, skipComments: true }] },
  },
  {
    files: ["tests/**/*.{ts,vue}"],
    rules: { "max-lines": ["error", { max: 450, skipBlankLines: true, skipComments: true }] },
  },
  ...oxlint.buildFromOxlintConfigFile(fileURLToPath(new URL(".oxlintrc.json", import.meta.url))),
];
