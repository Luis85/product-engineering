import { expect, expectTypeOf, it } from "vitest";
import { catalogOf, defineModule, describerOf } from "../../../src/application/module";
import type {
  CatalogOf,
  ErrorOf,
  ErrorTags,
  ModuleManifest,
} from "../../../src/application/module";

type MissingNote = { readonly _tag: "MissingNote"; readonly path: string };
type InvalidItem = { readonly _tag: "InvalidItem"; readonly id: number };

const notes = defineModule({
  name: "notes",
  catalog: { en: { title: "Missing note" }, de: { title: "Fehlende Notiz" } },
  errors: {
    tags: { MissingNote: true },
    describe: (error: MissingNote, messages) => ({
      severity: "warning",
      title: messages.title,
      detail: error.path,
    }),
  },
});

const items = defineModule({
  name: "items",
  catalog: { en: { title: "Invalid item" }, de: { title: "Ungültiger Eintrag" } },
  errors: {
    tags: { InvalidItem: true },
    describe: (error: InvalidItem, messages) => ({
      severity: "error",
      title: messages.title,
      detail: String(error.id),
    }),
  },
});

const modules = [notes, items] as const;

it("composes each translated module catalog by name", () => {
  expect(catalogOf(modules, "de")).toEqual({
    notes: { title: "Fehlende Notiz" },
    items: { title: "Ungültiger Eintrag" },
  });
  expectTypeOf<CatalogOf<(typeof modules)[number]>>().toEqualTypeOf<{
    readonly notes: { title: string };
    readonly items: { title: string };
  }>();
  expectTypeOf(notes).toExtend<ModuleManifest<"notes", { title: string }, MissingNote>>();
});

it("dispatches errors to their module with only its messages", () => {
  const describe = describerOf(modules);
  const messages = catalogOf(modules, "en");

  expect(describe({ _tag: "InvalidItem", id: 42 }, messages)).toEqual({
    severity: "error",
    title: "Invalid item",
    detail: "42",
  });
  expect(describe({ _tag: "MissingNote", path: "example" }, messages)).toEqual({
    severity: "warning",
    title: "Missing note",
    detail: "example",
  });
  expectTypeOf<ErrorOf<(typeof modules)[number]>>().toEqualTypeOf<MissingNote | InvalidItem>();
  expectTypeOf<ErrorTags<MissingNote | InvalidItem>>().toEqualTypeOf<{
    readonly MissingNote: true;
    readonly InvalidItem: true;
  }>();
});
