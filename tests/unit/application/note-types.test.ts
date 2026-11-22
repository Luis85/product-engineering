/// <reference types="vite/client" />

import { expect, it } from "vitest";
import { defineModule, noteTypesOf } from "../../../src/application/module";
import { appNoteTypes } from "../../../src/application/note-types";
import { testNoteType } from "../../support/notes/test-note-type";

const domainModules = import.meta.glob<Record<string, unknown>>("../../../src/domain/*/index.ts", {
  eager: true,
});

function isNoteType(value: unknown): boolean {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Readonly<Record<string, unknown>>;
  return (
    typeof candidate.type === "string" &&
    typeof candidate.version === "number" &&
    typeof candidate.decode === "function" &&
    typeof candidate.merge === "function"
  );
}

it("registers every note type exported by a domain module", () => {
  const exported = Object.values(domainModules)
    .flatMap((module) => Object.values(module))
    .filter(isNoteType);
  expect(new Set(appNoteTypes)).toEqual(new Set(exported));
});

it("reads the declarations from manifests and rejects duplicate type names", () => {
  const fixture = { name: "fixture", catalog: { en: {}, de: {} } };
  const definition = defineModule({ ...fixture, noteTypes: [testNoteType] });
  const duplicate = defineModule({
    ...fixture,
    name: "duplicate",
    noteTypes: [{ ...testNoteType }],
  });
  const empty = defineModule(fixture);
  expect(noteTypesOf([empty, definition])).toEqual([testNoteType]);
  expect(() => noteTypesOf([definition, duplicate])).toThrow("Duplicate note type test-record");
});
