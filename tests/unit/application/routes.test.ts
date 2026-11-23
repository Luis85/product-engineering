import { Schema } from "effect";
import { expect, expectTypeOf, it } from "vitest";
import { catalogFor } from "../../../src/application/messages";
import { defineModule, routeSchemasOf, sectionsOf } from "../../../src/application/module";
import type { RouteOf, SectionOf } from "../../../src/application/module";
import { appRoutes, Route, SETTINGS_SECTIONS } from "../../../src/application/routes";
import type { RouteNameOf, SectionIdOf, SettingsSection } from "../../../src/application/routes";
import {
  projectIdSchema,
  projectOriginSchema,
  projectRecordRoute,
} from "../../../src/application/projects";
import type { ProjectOrigin, ProjectRecordRoute } from "../../../src/application/projects";

it("starts at the project chooser and pins the ordered settings sections", () => {
  expect(SETTINGS_SECTIONS).toEqual(["items", "data-issues"]);
  expect(appRoutes.start).toEqual({ name: "projects" });
  expect(appRoutes.decode({ name: "settings", section: "unknown" })).toBe(appRoutes.start);
  expect(Schema.decodeUnknownSync(Route)({ name: "settings", section: "items" })).toEqual({
    name: "settings",
    section: "items",
  });
  expectTypeOf<SettingsSection>().toEqualTypeOf<"items" | "data-issues">();
  expectTypeOf<RouteNameOf<"shell">>().toEqualTypeOf<"settings">();
  expectTypeOf<RouteNameOf<"items">>().toEqualTypeOf<never>();
  expectTypeOf<RouteNameOf<"integrations">>().toEqualTypeOf<"agent-chat">();
  expectTypeOf<SectionIdOf<"items">>().toEqualTypeOf<"items">();
  expectTypeOf<SectionIdOf<"integrations">>().toEqualTypeOf<never>();
});

it("restores a scoped record and same-project origin from a saved leaf", () => {
  const projectId = Schema.decodeUnknownSync(projectIdSchema)(
    "project-33333333-3333-4333-8333-000000000001",
  );
  const origin: ProjectOrigin = Schema.decodeUnknownSync(projectOriginSchema)({
    section: "knowledge",
    reference: { kind: "knowledge", recordId: "PRD-02" },
  });
  const saved: ProjectRecordRoute = projectRecordRoute(
    { projectId, kind: "knowledge", recordId: "PRD-03" },
    origin,
  );
  expect(appRoutes.decode(saved)).toEqual(saved);
  expect(appRoutes.decode({ ...saved, projectId: "../Kundenportal" })).toBe(appRoutes.start);
  expect(appRoutes.decode({ ...saved, reference: { kind: "knowledge", recordId: "" } })).toBe(
    appRoutes.start,
  );
});

it("sorts section definitions across modules and preserves their ID union", () => {
  const catalog = { en: {}, de: {} };
  const modules = [
    defineModule({ name: "first", catalog, sections: [{ id: "tail", order: 300 }] }),
    defineModule({
      name: "second",
      catalog,
      sections: [
        { id: "first", order: 10 },
        { id: "middle", order: 100 },
      ],
    }),
    defineModule({ name: "no-sections", catalog }),
  ] as const;

  expect(sectionsOf(modules)).toEqual(["first", "middle", "tail"]);
  expectTypeOf<SectionOf<(typeof modules)[number]>>().toEqualTypeOf<"first" | "middle" | "tail">();
});

it("collects route schemas in manifest order and keeps each schema's parameters", () => {
  const catalog = { en: {}, de: {} };
  const First = Schema.Struct({ name: Schema.Literal("first"), id: Schema.String });
  const Later = Schema.Struct({ name: Schema.Literal("later") });
  const modules = [
    defineModule({ name: "first", catalog, routes: [First] }),
    defineModule({ name: "without-route", catalog }),
    defineModule({ name: "later", catalog, routes: [Later] }),
  ] as const;

  const schemas = routeSchemasOf(modules);
  expect(schemas).toEqual([First, Later]);
  expectTypeOf<(typeof schemas)[number]>().toEqualTypeOf<typeof First | typeof Later>();
  expectTypeOf<RouteOf<(typeof modules)[number]>>().toEqualTypeOf<
    typeof First.Type | typeof Later.Type
  >();
});

it("localizes the item section and its empty state", () => {
  expect(catalogFor("en").items.settings).toMatchObject({ label: "Items", empty: "No items yet." });
  expect(catalogFor("de").items.settings).toMatchObject({
    label: "Einträge",
    empty: "Noch keine Einträge.",
  });
});
