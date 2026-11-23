import type { Pos } from "obsidian";
import { parse, stringify } from "yaml";

type Scalar = string | number | boolean | null;
type ScalarMap = Record<string, Scalar>;
type YamlValue = Scalar | readonly (Scalar | ScalarMap)[];
export type YamlMap = Record<string, YamlValue>;

export class YAMLParseError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message, { cause });
    this.name = "YAMLParseError";
  }
}

function scalar(value: unknown): value is Scalar {
  return (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  );
}

function yamlValue(value: unknown): value is YamlValue {
  return (
    scalar(value) ||
    (Array.isArray(value) && value.every((item) => scalar(item) || scalarMap(item)))
  );
}

function scalarMap(value: unknown): value is ScalarMap {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.values(value).every(scalar)
  );
}

export function yamlMap(input: unknown): YamlMap | undefined {
  if (input === null || typeof input !== "object" || Array.isArray(input)) return;
  if (Object.values(input).every(yamlValue)) return input as YamlMap;
}

export function parseYaml(text: string): unknown {
  let decoded: unknown;
  try {
    decoded = parse(text, { version: "1.2", schema: "core" });
  } catch (cause) {
    throw new YAMLParseError("Invalid test YAML", cause);
  }
  if (!yamlValue(decoded) && !yamlMap(decoded)) {
    throw new YAMLParseError("Expected flat test YAML");
  }
  return decoded;
}

export function stringifyYaml(value: unknown): string {
  if (!yamlValue(value) && !yamlMap(value)) throw new YAMLParseError("Expected flat test YAML");
  return stringify(value, { version: "1.2", schema: "core" });
}

export function withoutBom(text: string): string {
  return text.replace(/^\uFEFF/, "");
}

type YamlBlock = {
  readonly yaml: string;
  readonly body: string;
  readonly position: Pos;
  readonly eol: "\n" | "\r\n" | "\r";
};

export function yamlBlock(raw: string): YamlBlock | undefined {
  const text = withoutBom(raw);
  const lines = text.match(/[^\r\n]+(?:\r\n|\r|\n|$)|\r\n|\r|\n/g) ?? [];
  const opening = lines[0];
  const eol = opening?.slice(3);
  if (!opening?.startsWith("---") || (eol !== "\n" && eol !== "\r\n" && eol !== "\r")) return;
  const closing = lines.findIndex((line, index) => index > 0 && line.startsWith("---"));
  const fence = lines[closing];
  if (!fence) return;

  const yaml = lines.slice(1, closing).join("");
  const col = fence.replace(/\r?\n$|\r$/, "").length;
  return {
    yaml,
    body: lines.slice(closing + 1).join(""),
    eol,
    position: {
      start: { line: 0, col: 0, offset: 0 },
      end: { line: closing, col, offset: opening.length + yaml.length + col },
    },
  };
}
