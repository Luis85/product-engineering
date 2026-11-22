import type { Pos } from "obsidian";
import { parse, stringify } from "yaml";

type Scalar = string | number | boolean | null;
type YamlValue = Scalar | readonly Scalar[];
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
  return scalar(value) || (Array.isArray(value) && value.every(scalar));
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
  readonly eol: "\n" | "\r\n";
};

export function yamlBlock(raw: string): YamlBlock | undefined {
  const text = withoutBom(raw);
  const lines = text.match(/[^\n]+(?:\n|$)|\n/g) ?? [];
  const opening = lines[0];
  if (opening !== "---\n" && opening !== "---\r\n") return;
  const closing = lines.findIndex((line, index) => index > 0 && /^---(?:\r?\n)?$/.test(line));
  if (closing === -1) return;

  const yaml = lines.slice(1, closing).join("");
  return {
    yaml,
    body: lines.slice(closing + 1).join(""),
    eol: opening.endsWith("\r\n") ? "\r\n" : "\n",
    position: {
      start: { line: 0, col: 0, offset: 0 },
      end: { line: closing, col: 3, offset: opening.length + yaml.length + 3 },
    },
  };
}
