import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, parse, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import manifest from "../manifest.json" with { type: "json" };

/** @typedef {{seed: number, items: number, records: number, plain: number}} ReferenceProfile */

/** @type {Readonly<ReferenceProfile>} */
export const REFERENCE_PROFILE = Object.freeze({
  seed: 21_845,
  items: 1_000,
  records: 2_000,
  plain: 200,
});

/** @param {number} seed */
function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = Math.imul(state ^ (state >>> 15), state | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

/**
 * @param {'item' | 'entry'} type
 * @param {number} number
 * @param {() => number} random
 */
function recordText(type, number, random) {
  const label = type === "item" ? "Item" : "Entry";
  const id = `${type}-00000000-0000-0000-0000-${number.toString(16).padStart(12, "0")}`;
  const month = String(Math.floor(random() * 12) + 1).padStart(2, "0");
  const day = String(Math.floor(random() * 28) + 1).padStart(2, "0");
  const status = random() < 0.5 ? "open" : "done";
  const dateField = type === "item" ? "due" : "date";
  return [
    "---",
    `schema: ${manifest.id}.${type}/v1`,
    `id: ${id}`,
    `title: ${label} ${number}`,
    `status: ${status}`,
    `${dateField}: "2025-${month}-${day}"`,
    "---",
    "",
    `Reference ${label.toLowerCase()} ${number}.`,
    "",
  ].join("\n");
}

/** @param {Partial<ReferenceProfile>} [options] */
export function referenceVault(options = {}) {
  const { seed, items, records, plain } = { ...REFERENCE_PROFILE, ...options };
  if (
    ![items, records, plain].every((count) => Number.isSafeInteger(count) && count >= 0) ||
    items > records
  ) {
    throw new RangeError(
      "Reference vault counts must be nonnegative integers and items must fit within records",
    );
  }

  const random = seededRandom(seed);
  /** @type {Map<string, string>} */
  const files = new Map();
  for (let number = 1; number <= items; number += 1) {
    files.set(`Items/Item ${number}.md`, recordText("item", number, random));
  }
  for (let number = 1; number <= records - items; number += 1) {
    const area = ((number - 1) % 5) + 1;
    files.set(`Entries/Area ${area}/Entry ${number}.md`, recordText("entry", number, random));
  }
  for (let number = 1; number <= plain; number += 1) {
    files.set(`Plain/Note ${number}.md`, `# Note ${number}\n\nReference note ${number}.\n`);
  }
  return files;
}

/**
 * @param {string} target
 * @param {Partial<ReferenceProfile>} [options]
 */
export function writeReferenceVault(target, options) {
  const directory = resolve(target);
  const fromDirectory = relative(directory, process.cwd());
  const containsWorkingTree =
    fromDirectory !== ".." && !fromDirectory.startsWith(`..${sep}`) && !isAbsolute(fromDirectory);
  if (containsWorkingTree || directory === parse(directory).root) {
    throw new Error("Choose a dedicated target directory for the reference vault.");
  }

  const files = referenceVault(options);
  rmSync(directory, { recursive: true, force: true });
  mkdirSync(directory, { recursive: true });
  for (const [path, text] of files) {
    const file = join(directory, path);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, text);
  }
}

const entry = process.argv[1];
if (entry && pathToFileURL(resolve(entry)).href === import.meta.url) {
  const target = process.argv[2];
  if (target === undefined) throw new Error("Usage: node scripts/reference-vault.mjs <target>");
  writeReferenceVault(target);
}
