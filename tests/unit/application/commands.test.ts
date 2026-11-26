import { expect, it } from "vitest";
import { appCommands } from "../../../src/application/commands";
import { catalogFor } from "../../../src/application/messages";

it("composes commands by id with labels in both languages", () => {
  expect(appCommands.map(({ id, action }) => [id, action._tag])).toEqual([
    ["open-view", "open"],
    ["copy-diagnostics", "run"],
    ["search-project", "open"],
  ]);
  expect(appCommands.map(({ name }) => name(catalogFor("en")))).toEqual([
    "Open Product Engineering",
    "Copy diagnostics",
    "Search project",
  ]);
  expect(appCommands.map(({ name }) => name(catalogFor("de")))).toEqual([
    "Product Engineering öffnen",
    "Diagnose kopieren",
    "Projekt durchsuchen",
  ]);
});
