import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { expect, expectTypeOf, it } from "vitest";
import { ROOT } from "../../../configs/vitest.config";
import { readModules } from "../../../scripts/modules.mjs";
import type { Catalog } from "../../../src/application/messages";
import { APP_MODULES } from "../../../src/application/modules";
import type { AppModule, AppModuleName } from "../../../src/application/modules";
import { SETTINGS_SECTIONS } from "../../../src/application/routes";
import { LANGUAGES } from "../../../src/application/shell";
import { catalogOf } from "../../../src/application/module";

const layers = [
  "domain",
  "application",
  "infrastructure/obsidian",
  "infrastructure/memory",
  "presentation",
];

it("registers every module folder and a manifest for every registered name", () => {
  const names: readonly string[] = APP_MODULES.map((module) => module.name);

  for (const layer of layers) {
    const folder = join(ROOT, "src", layer);
    if (!existsSync(folder)) continue;
    for (const entry of readdirSync(folder, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      expect(names, `Register src/${layer}/${entry.name} in APP_MODULES`).toContain(entry.name);
    }
  }
  for (const name of names) {
    expect(existsSync(join(ROOT, "src", "application", name, "module.ts"))).toBe(true);
    expect(
      existsSync(join(ROOT, "src", "presentation", name, "screens.ts")),
      `Screens manifest for ${name}`,
    ).toBe(true);
  }
  expect(readModules().all).toEqual(names);
  expect(new Set(names).size).toBe(names.length);
  expectTypeOf<AppModule["name"]>().toEqualTypeOf<AppModuleName>();
  expectTypeOf<keyof Catalog>().toEqualTypeOf<AppModuleName>();
});

it("registers every application error tag and settings section once", () => {
  const tags = APP_MODULES.flatMap((module) =>
    "errors" in module ? Object.keys(module.errors.tags) : [],
  );
  expect(new Set(tags).size).toBe(tags.length);
  expect(new Set(SETTINGS_SECTIONS).size).toBe(SETTINGS_SECTIONS.length);
});

it("registers each supported language", () => {
  for (const language of LANGUAGES) {
    expect(catalogOf(APP_MODULES, language).shell.language).toBe(language);
  }
});
