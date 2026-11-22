const date = /^\d{4}-\d{2}-\d{2}$/;
const plain = /^[\p{L}_/][\p{L}\p{M}\p{N}_ .@/+()'-]*$/u;
const legacyLiteral = /^(?:y|n|yes|no|on|off|true|false|null|e[+-]?\d+)$/i;
const escapedCharacters = /[\u007f-\u009f\u2028\u2029\ufeff\ufffe\uffff]/g;

function yamlString(value: string): string {
  // YAML 1.1 resolves plain dates as timestamps. The tag preserves the string.
  if (date.test(value)) return "!!str " + value;
  if (value === value.trim() && plain.test(value) && !legacyLiteral.test(value)) return value;
  return JSON.stringify(value).replaceAll(
    escapedCharacters,
    (character) => "\\u" + character.charCodeAt(0).toString(16).padStart(4, "0"),
  );
}

function yamlNumber(value: number): string {
  if (Number.isNaN(value)) return ".nan";
  if (value === Infinity) return ".inf";
  if (value === -Infinity) return "-.inf";
  if (Object.is(value, -0)) return "-0";
  return String(value);
}

function yamlScalar(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "string") return yamlString(value);
  if (typeof value === "number") return yamlNumber(value);
  if (typeof value === "boolean") return String(value);
  throw new TypeError("Unsupported frontmatter value");
}

export function yamlEntry(key: string, value: unknown, eol: "\n" | "\r\n"): string {
  const text = Array.isArray(value)
    ? "[" + Array.from(value, yamlScalar).join(", ") + "]"
    : yamlScalar(value);
  return yamlString(key) + ": " + text + eol;
}
