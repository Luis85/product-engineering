export const RECORD_SCHEMA_PREFIX = "product-engineering.";

type SchemaMarker =
  | { readonly _tag: "none" }
  | { readonly _tag: "malformed" }
  | { readonly _tag: "record"; readonly type: string; readonly version: number };

const marker = /^([a-z]+(?:-[a-z]+)*)\/v([1-9]\d*)$/;

export function parseSchemaMarker(value: unknown): SchemaMarker {
  if (typeof value !== "string" || !value.startsWith(RECORD_SCHEMA_PREFIX)) {
    return { _tag: "none" };
  }
  const match = marker.exec(value.slice(RECORD_SCHEMA_PREFIX.length));
  const type = match?.[1];
  const version = Number(match?.[2]);
  return type && Number.isSafeInteger(version)
    ? { _tag: "record", type, version }
    : { _tag: "malformed" };
}
