import { Result } from "effect";
import { sameFrontmatter, sameFrontmatterValue } from "./frontmatter-equality";
import { frontmatterLines } from "./frontmatter-lines";
import type { Frontmatter } from "./note-type";
import { type TextLine, textLines } from "./text-lines";
import { yamlEntry } from "./yaml-text";

type LineEnding = "\n" | "\r\n";

interface FrontmatterText {
  readonly opening: string;
  readonly yaml: string;
  readonly closing: string;
}

export interface SplitNoteText {
  readonly text: string;
  readonly bom: string;
  readonly body: string;
  readonly eol: LineEnding;
  readonly layoutSupported: boolean;
  readonly frontmatter?: FrontmatterText;
}

export function newNoteText(frontmatter: Frontmatter, body = ""): string {
  const entries = Object.entries(frontmatter).flatMap(([key, value]) =>
    value === undefined ? [] : [yamlEntry(key, value, "\n")],
  );
  return entries.length > 0 ? "---\n" + entries.join("") + "---\n" + body : body;
}

function closingLine(lines: Iterable<TextLine>): TextLine | undefined {
  for (const line of lines) {
    if (line.content.startsWith("---")) return line;
  }
  return undefined;
}

export function splitNoteText(text: string): SplitNoteText {
  const bom = text.startsWith("\uFEFF") ? "\uFEFF" : "";
  const content = text.slice(bom.length);
  const lines = textLines(content);
  const first = lines.next();
  const opening = first.done ? undefined : first.value;
  const eol = opening?.eol === "\r\n" ? "\r\n" : "\n";
  const hasSupportedEol = !/\r(?!\n)/.test(content);
  const split = { text, bom, body: content, eol, layoutSupported: hasSupportedEol } as const;

  if (opening === undefined) return split;
  if (opening.content !== "---") {
    return { ...split, layoutSupported: hasSupportedEol && !/^[ \t]*---/.test(opening.content) };
  }

  const closing = closingLine(lines);
  if (closing === undefined) return split;
  return {
    ...split,
    body: content.slice(closing.end),
    layoutSupported: hasSupportedEol && /^(?:---[ \t]*|----)$/.test(closing.content),
    frontmatter: {
      opening: content.slice(0, opening.end),
      yaml: content.slice(opening.end, closing.start),
      closing: content.slice(closing.start, closing.end),
    },
  };
}

export function frontmatterYaml(split: SplitNoteText): string | undefined {
  return split.frontmatter?.yaml;
}

function writtenEntry(key: string, value: unknown, eol: LineEnding, comment?: string): string {
  const entry = yamlEntry(key, value, eol, "block");
  if (comment === undefined) return entry;
  const firstLineEnd = entry.indexOf(eol);
  return entry.slice(0, firstLineEnd) + comment + entry.slice(firstLineEnd);
}

function addedEntries(before: Frontmatter, after: Frontmatter, eol: LineEnding): string {
  return Object.entries(after)
    .filter(([key]) => !Object.hasOwn(before, key))
    .map(([key, value]) => writtenEntry(key, value, eol))
    .join("");
}

function editFrontmatter(
  yaml: string,
  before: Frontmatter,
  after: Frontmatter,
  eol: LineEnding,
): string | undefined {
  const entries = frontmatterLines(yaml);
  const keys = Object.keys(before);
  if (entries === undefined || entries.length !== keys.length) return undefined;
  if (!entries.every(({ key }, index) => key === keys[index])) return undefined;

  let updated = "";
  let start = 0;
  for (const entry of entries) {
    const { key, end } = entry;
    updated += yaml.slice(start, entry.start);
    if (Object.hasOwn(after, key)) {
      updated += sameFrontmatterValue(before[key], after[key])
        ? yaml.slice(entry.start, end)
        : writtenEntry(key, after[key], eol, entry.comment);
    }
    start = end;
  }
  return updated + yaml.slice(start) + addedEntries(before, after, eol);
}

function joinNoteText(split: SplitNoteText, yaml: string): string {
  const { bom, body, eol, frontmatter } = split;
  if (yaml === "") return bom + body;
  const fence = "---" + eol;
  return bom + (frontmatter?.opening ?? fence) + yaml + (frontmatter?.closing ?? fence) + body;
}

export function editNoteText(
  split: SplitNoteText,
  before: Frontmatter,
  after: Frontmatter,
): Result.Result<string, "layout"> {
  if (sameFrontmatter(before, after)) return Result.succeed(split.text);
  if (!split.layoutSupported) return Result.fail("layout");

  const yaml = editFrontmatter(split.frontmatter?.yaml ?? "", before, after, split.eol);
  if (yaml === undefined) return Result.fail("layout");
  return Result.succeed(joinNoteText(split, yaml));
}
