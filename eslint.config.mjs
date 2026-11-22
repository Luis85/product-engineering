import { fileURLToPath } from "node:url";
import obsidianmd from "eslint-plugin-obsidianmd";
import oxlint from "eslint-plugin-oxlint";
import vue from "eslint-plugin-vue";
import globals from "globals";
import tseslint from "typescript-eslint";
import vueParser from "vue-eslint-parser";
import { readModules } from "./scripts/modules.mjs";

const root = fileURLToPath(new URL(".", import.meta.url));
const project = [
  "./configs/tsconfig.app.json",
  "./configs/tsconfig.node.json",
  "./tests/e2e/tsconfig.json",
];
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

const modules = readModules();
const secondEntries = new Map([
  ["shell", "host"],
  ["notes", "adapter"],
]);

/** @param {string[]} extra */
function pastIndexWith(extra = []) {
  return modules.all.map((module) => {
    const secondEntry = secondEntries.get(module);
    const publicEntries = secondEntry ? ["index", secondEntry, ...extra] : ["index", ...extra];
    return {
      regex: `(^|/)${module}/(?!(${publicEntries.join("|")})(\\.[cm]?ts)?$)`,
      message: `Import module ${module} only through its index.ts.`,
    };
  });
}

const pastIndex = [
  ...pastIndexWith(),
  {
    regex: "(^|/)(?<!presentation/)shell/host(\\.[cm]?ts)?$",
    message: "Import the shell host through the presentation layer.",
  },
];
const kitOutside = {
  regex: "(^|/)notes/adapter(\\.[cm]?ts)?$",
  message: "The NoteStore adapter kit is for infrastructure only.",
};
const kitElsewhere = {
  regex: "(^|/)(?<!application/)notes/adapter(\\.[cm]?ts)?$",
  message: "Import the NoteStore adapter kit through the application layer.",
};
const testOnly = {
  regex: "(^|/)memory(/|$)",
  message: "The in-memory adapters are for tests and the harness only.",
};

/** @param {string[]} files @param {{regex: string, message: string}[]} patterns */
function restrictModules(files, patterns) {
  return { files, rules: { "no-restricted-imports": ["error", { patterns }] } };
}

/** @param {string[]} files @param {string} regex */
function vueFreeAtLoad(files, regex) {
  return {
    files,
    rules: {
      "@typescript-eslint/no-restricted-imports": [
        "error",
        {
          patterns: [
            { regex, allowTypeImports: true, message: "Load presentation modules lazily." },
          ],
        },
      ],
    },
  };
}

const moduleNames = modules.all.join("|");
const moduleEntry = `(?:${moduleNames})(?:/index)?(?:\\.[cm]?ts)?$`;
const sourceFiles = ["src/**/*.{ts,vue}"];
const adapterFiles = ["src/infrastructure/**/*.ts"];
const presentationCompositionFiles = ["src/presentation/*.ts"];
const coreDirections = modules.core.map((module, index) => {
  const forbidden = modules.all.slice(index + 1);
  return {
    folders: [
      `src/domain/${module}/**`,
      `src/application/${module}/**`,
      `src/infrastructure/obsidian/${module}/**`,
      `src/infrastructure/memory/${module}/**`,
      `src/presentation/${module}/**`,
    ],
    patterns: forbidden.map((target) => ({
      regex: `(^|/)${target}(/|$)`,
      message: `Module ${module} never imports ${target}. Follow feature → notes → shell.`,
    })),
  };
});

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
    // The desktop-only listener and CLI adapter use the host's Node runtime.
    files: ["src/infrastructure/mcp/**/*.ts", "src/infrastructure/provider-cli/**/*.ts"],
    rules: { "obsidianmd/no-nodejs-modules": "off" },
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
  restrictModules(sourceFiles, [...pastIndex, kitOutside, testOnly]),
  restrictModules(adapterFiles, [...pastIndex, kitElsewhere, testOnly]),
  restrictModules(presentationCompositionFiles, [
    ...pastIndexWith(["screens"]),
    kitOutside,
    testOnly,
  ]),
  vueFreeAtLoad(
    ["src/main.ts", "src/bootstrap.ts", ...adapterFiles],
    `(^|/)presentation/${moduleEntry}`,
  ),
  vueFreeAtLoad(presentationCompositionFiles, `^\\./${moduleEntry}`),
  vueFreeAtLoad(
    ["src/presentation/*/screens.ts"],
    `^(vue(/|$)|@(vue|nuxt|tanstack|iconify)/)|\\.vue$|^\\./index(\\.[cm]?ts)?$|^\\.\\./${moduleEntry}`,
  ),
  ...coreDirections.flatMap(({ folders, patterns }) => [
    restrictModules(folders, [...pastIndex, kitOutside, testOnly, ...patterns]),
    restrictModules(
      folders.filter((folder) => folder.startsWith("src/infrastructure/")),
      [...pastIndex, kitElsewhere, testOnly, ...patterns],
    ),
  ]),
];
