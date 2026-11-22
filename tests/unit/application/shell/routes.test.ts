import { Schema } from "effect";
import { expect, expectTypeOf, it } from "vitest";
import { routesOf, SETTINGS, settingsRoute } from "../../../../src/application/shell";
import type { SettingsRoute } from "../../../../src/application/shell";

const Home = Schema.Struct({ name: Schema.Literal("home") });
const Item = Schema.Struct({ name: Schema.Literal("item"), id: Schema.String });
const routes = routesOf(Schema.Union([Home, Item]), { name: "home" });

it("decodes a valid route with its parameters", () => {
  expect(routes.decode({ name: "item", id: "note-7" })).toEqual({
    name: "item",
    id: "note-7",
  });
  expect(routes.decode({ name: "home" })).toEqual({ name: "home" });
});

it.each([
  null,
  undefined,
  "item",
  [],
  {},
  { name: "unknown" },
  { name: "item" },
  { name: "item", id: 7 },
])("restores the start route for invalid state %j", (input) => {
  expect(routes.decode(input)).toBe(routes.start);
});

it("falls back to the start even when reading a broken state object throws", () => {
  const input = {
    get name(): string {
      throw new Error("broken route");
    },
  };
  expect(routes.decode(input)).toBe(routes.start);
});

it("compares route parameters by schema value", () => {
  expect(routes.equals({ name: "item", id: "first" }, { name: "item", id: "first" })).toBe(true);
  expect(routes.equals({ name: "item", id: "first" }, { name: "item", id: "next" })).toBe(false);
  expect(routes.equals({ name: "home" }, { name: "item", id: "first" })).toBe(false);
});

it("only accepts sections in the settings schema", () => {
  const schema = settingsRoute(["items", "notes"]);
  const settings = routesOf(schema, { name: SETTINGS, section: "items" });
  expectTypeOf<typeof schema.Type>().toEqualTypeOf<SettingsRoute<"items" | "notes">>();
  expect(settings.decode({ name: SETTINGS, section: "notes" })).toEqual({
    name: SETTINGS,
    section: "notes",
  });
  expect(settings.decode({ name: SETTINGS, section: "removed" })).toBe(settings.start);
});
