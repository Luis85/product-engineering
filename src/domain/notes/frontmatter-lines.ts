import { quotedEnd, scanValueLine } from "./line-comment";
import { type TextLine, textLines } from "./text-lines";

interface EntryLine {
  readonly key: string;
  readonly value: string;
}

interface EntrySpan {
  readonly key: string;
  readonly start: number;
  readonly comment: string | undefined;
  end: number;
}

interface CurrentEntry {
  readonly span: EntrySpan;
  readonly blockScalar: boolean;
  multiline: boolean;
}

const inlineSeparator = /^:(?=[ \t]|$)/;
const plainKey = /^([^&*?\-:![\]{},#%@`|>][^\r\n]*?):(?=[ \t]|$)/;
const listItem = /^-(?=[ \t]|$)/;
const indented = /^[ \t]/;
const blockScalar = /^[ \t]*[|>]/;

function quotedKey(text: string): string | undefined {
  if (text.startsWith("'")) return text.slice(1, -1).replaceAll("''", "'");
  try {
    const value: unknown = JSON.parse(text);
    return typeof value === "string" ? value : undefined;
  } catch {
    return undefined;
  }
}

function keyLine(text: string): EntryLine | undefined {
  if (text.startsWith('"') || text.startsWith("'")) {
    const end = quotedEnd(text, 0);
    if (!inlineSeparator.test(text.slice(end + 1))) return undefined;
    const key = quotedKey(text.slice(0, end + 1));
    return key === undefined ? undefined : { key, value: text.slice(end + 2) };
  }
  const match = plainKey.exec(text);
  if (match === null) return undefined;
  const name = match[1];
  return name === undefined
    ? undefined
    : { key: name.trimEnd(), value: text.slice(match[0].length) };
}

function openEntry(line: TextLine): CurrentEntry | undefined {
  const entry = keyLine(line.content);
  if (entry === undefined) return undefined;
  const value = scanValueLine(entry.value);
  if (value.anchored) return undefined;
  return {
    span: { key: entry.key, start: line.start, end: line.end, comment: value.comment },
    blockScalar: blockScalar.test(entry.value),
    multiline: false,
  };
}

function continuationValue(text: string): string {
  const trimmed = text.trimStart();
  const value = listItem.test(trimmed) ? trimmed.slice(1).trimStart() : trimmed;
  return keyLine(value)?.value ?? value;
}

function extendEntry(line: TextLine, current: CurrentEntry | undefined): boolean {
  if (current === undefined) return false;
  if (!current.blockScalar && scanValueLine(continuationValue(line.content)).anchored) return false;
  current.multiline = true;
  current.span.end = line.end;
  return true;
}

function keepCommentWithValue(line: TextLine, current: CurrentEntry | undefined): void {
  if (current === undefined || !indented.test(line.content)) return;
  if (current.blockScalar || current.multiline) current.span.end = line.end;
}

export function frontmatterLines(yaml: string): readonly EntrySpan[] | undefined {
  const entries: EntrySpan[] = [];
  let current: CurrentEntry | undefined;
  for (const line of textLines(yaml)) {
    const trimmed = line.content.trimStart();
    if (trimmed === "") continue;
    if (trimmed.startsWith("#")) {
      keepCommentWithValue(line, current);
    } else if (indented.test(line.content) || listItem.test(line.content)) {
      if (!extendEntry(line, current)) return undefined;
    } else {
      current = openEntry(line);
      if (current === undefined) return undefined;
      entries.push(current.span);
    }
  }
  return entries;
}
