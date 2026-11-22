import { expect, it } from "vitest";
import { parseModuleNames, readModules } from "../../../scripts/modules.mjs";

it("reads module folders from static bindings in list order", () => {
  const source = `
    import { itemsModule as items } from "./items";
    import { shellModule } from "./shell";
    import { notesModule } from "./notes";
    export const APP_MODULES = [shellModule, notesModule, items] as const;
  `;

  expect(parseModuleNames(source)).toEqual(["shell", "notes", "items"]);
  expect(readModules(source)).toEqual({
    all: ["shell", "notes", "items"],
    core: ["shell", "notes"],
    features: ["items"],
  });
});

it("names a list item that has no import from its module folder", () => {
  const source = `
    import { shellModule } from "./shell";
    import { items } from "./items/module";
    export const APP_MODULES = [shellModule, items] as const;
  `;

  expect(() => parseModuleNames(source)).toThrow('items must be imported from "./<module>"');
});

it("requires core modules to lead the list", () => {
  const source = `
    import { itemsModule } from "./items";
    import { shellModule } from "./shell";
    export const APP_MODULES = [itemsModule, shellModule] as const;
  `;

  expect(() => readModules(source)).toThrow("APP_MODULES must start with shell, notes");
});
