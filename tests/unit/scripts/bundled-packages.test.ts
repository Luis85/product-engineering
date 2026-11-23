import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { build } from "vite";
import { expect, it } from "vitest";
import { bundledPackages, PACKAGES_FILE } from "../../../scripts/bundled-packages.mjs";

function write(root: string, file: string, content: string): void {
  const target = join(root, file);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, content);
}

function packageAt(root: string, directory: string, name: string, code: string): void {
  write(
    root,
    `${directory}/package.json`,
    JSON.stringify({ name, type: "module", main: "index.js" }),
  );
  write(root, `${directory}/index.js`, code);
}

function fixture(root: string): void {
  write(root, "package.json", JSON.stringify({ name: "inventory-test", type: "module" }));
  packageAt(root, "node_modules/live", "live", 'export default "outer live";');
  packageAt(
    root,
    "node_modules/nested",
    "nested",
    'import child from "live"; export default child + "!";',
  );
  packageAt(root, "node_modules/nested/node_modules/live", "live", 'export default "inner live";');
  packageAt(root, "node_modules/unused", "unused", 'export default "tree-shaken";');
  packageAt(root, "node_modules/@fixture/styles", "@fixture/styles", "");
  packageAt(root, "node_modules/@iconify-json/lucide", "@iconify-json/lucide", "");
  packageAt(root, "node_modules/@iconify-json/unused", "@iconify-json/unused", "");
  write(root, "node_modules/@fixture/styles/tokens.css", ".packaged { color: blue; }");
  write(root, "src/app.css", '@import "./theme.css";\n.visible { color: red; }');
  write(root, "src/theme.css", '@import "@fixture/styles/tokens.css" layer(theme);');
  write(
    root,
    "src/main.js",
    [
      'import "./app.css";',
      'import live from "live";',
      'import nested from "nested";',
      'import unused from "unused";',
      'import icon from "virtual:nuxt-ui-icons";',
      "export const output = live + nested + icon;",
    ].join("\n"),
  );
}

async function buildFixture(root: string, mode = "production"): Promise<void> {
  await build({
    configFile: false,
    root,
    mode,
    logLevel: "silent",
    plugins: [
      {
        name: "fixture-icons",
        resolveId: (id) => (id === "virtual:nuxt-ui-icons" ? "\0" + id : undefined),
        load: (id) =>
          id === "\0virtual:nuxt-ui-icons" ? 'export default "a bundled icon";' : undefined,
      },
      bundledPackages({
        root,
        icons: ["lucide:arrow-left", "lucide:settings"],
        stylesheets: ["src/app.css"],
      }),
    ],
    build: {
      lib: {
        entry: "src/main.js",
        formats: ["cjs"],
        fileName: () => "main.js",
        cssFileName: "styles",
      },
      minify: false,
    },
  });
}

function hash(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

it("reports emitted packages and exact output hashes, including nested installations, icons, and CSS", async () => {
  const root = mkdtempSync(join(tmpdir(), "product-engineering-bundled-"));
  try {
    fixture(root);
    await buildFixture(root);
    const report: unknown = JSON.parse(readFileSync(join(root, PACKAGES_FILE), "utf8"));
    expect(report).toEqual({
      sha256: hash(join(root, "dist/main.js")),
      stylesSha256: hash(join(root, "dist/styles.css")),
      packages: [
        { name: "@fixture/styles", directory: "node_modules/@fixture/styles" },
        { name: "@iconify-json/lucide", directory: "node_modules/@iconify-json/lucide" },
        { name: "live", directory: "node_modules/live" },
        { name: "live", directory: "node_modules/nested/node_modules/live" },
        { name: "nested", directory: "node_modules/nested" },
      ],
    });
    expect(readFileSync(join(root, "dist/styles.css"), "utf8")).toContain(".packaged");
  } finally {
    rmSync(root, { force: true, recursive: true });
  }
});

it("writes the inventory only for production output", async () => {
  const root = mkdtempSync(join(tmpdir(), "product-engineering-bundled-"));
  try {
    fixture(root);
    await buildFixture(root, "development");
    expect(existsSync(join(root, "dist/main.js"))).toBe(true);
    expect(existsSync(join(root, PACKAGES_FILE))).toBe(false);
  } finally {
    rmSync(root, { force: true, recursive: true });
  }
});
