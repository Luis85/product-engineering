import type { Frontmatter } from "./note-type";
import { parseSchemaMarker } from "./schema-marker";

export const MAX_NAME_ATTEMPTS = 100;
export const NOTE_NAME_ISSUES = ["empty", "forbidden-character", "leading-dot"] as const;

export type NoteNameIssue = (typeof NOTE_NAME_ISSUES)[number];

const forbidden = /[*"<>:|?/\\\p{Cc}]/u;

export function clashKey(name: string): string {
  return name.normalize("NFC").toLowerCase();
}

export function clashName(name: string, attempt: number): string {
  return attempt <= 1 ? name : name + " (" + attempt + ")";
}

export function noteNameIssue(name: string): NoteNameIssue | undefined {
  const trimmed = name.trim();
  if (trimmed === "") return "empty";
  if (trimmed.startsWith(".")) return "leading-dot";
  if (forbidden.test(trimmed)) return "forbidden-character";
}

export function isRecordFrontmatter(frontmatter: Frontmatter): boolean {
  return parseSchemaMarker(frontmatter.schema)._tag !== "none";
}
