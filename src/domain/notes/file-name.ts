import { isControlCharacter } from "./fields";
import { clashKey, clashName, MAX_NAME_ATTEMPTS } from "./notes";

export const MAX_FILE_NAME_BYTES = 255;

const forbidden = new Set('\\/:*?"<>|#^[]');
const encoder = new TextEncoder();

function replaceForbiddenRuns(title: string): string {
  let safe = "";
  let insideRun = false;
  for (const character of title) {
    if (forbidden.has(character) || isControlCharacter(character)) {
      if (!insideRun) safe += "-";
      insideRun = true;
    } else {
      safe += character;
      insideRun = false;
    }
  }
  return safe;
}

export function recordFileName(title: string, fallback: string): string {
  const name = replaceForbiddenRuns(title)
    .replaceAll(/\s+/gu, " ")
    .replace(/^[. ]+|[. ]+$/g, "");
  return name || fallback;
}

export function fitsFileName(title: string, fallback: string): boolean {
  const longest = clashName(recordFileName(title, fallback), MAX_NAME_ATTEMPTS) + ".md";
  return encoder.encode(longest).byteLength <= MAX_FILE_NAME_BYTES;
}

export function followsTitle(fileName: string, title: string, fallback: string): boolean {
  const expected = clashKey(recordFileName(title, fallback));
  const actual = clashKey(fileName);
  if (actual === expected) return true;

  const suffix = / \(([1-9]\d*)\)$/.exec(actual);
  if (!suffix) return false;
  const attempt = Number(suffix[1]);
  return attempt > 1 && attempt <= MAX_NAME_ATTEMPTS && actual.slice(0, suffix.index) === expected;
}
