import { expect, it } from "vitest";
import { parseSchemaMarker, RECORD_SCHEMA_PREFIX } from "../../../../src/domain/notes";

it("parses kebab-case types and positive versions", () => {
  expect(RECORD_SCHEMA_PREFIX).toBe("product-engineering.");
  expect(parseSchemaMarker("product-engineering.release-note/v12")).toEqual({
    _tag: "record",
    type: "release-note",
    version: 12,
  });
});

it.each([
  "product-engineering.",
  "product-engineering.release_note/v1",
  "product-engineering.Release/v1",
  "product-engineering.release2/v1",
  "product-engineering.release--note/v1",
  "product-engineering.item/v0",
  "product-engineering.item/v01",
  "product-engineering.item/v1/extra",
  "product-engineering.item/v1\n",
  "product-engineering.item/v9007199254740992",
])("distinguishes a malformed plugin marker %s", (value) => {
  expect(parseSchemaMarker(value)).toEqual({ _tag: "malformed" });
});

it.each([undefined, false, 7, "product-engineering", "other.item/v1"])(
  "ignores a non-plugin value %j",
  (value) => {
    expect(parseSchemaMarker(value)).toEqual({ _tag: "none" });
  },
);
