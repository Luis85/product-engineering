import { isRecordFrontmatter } from "../../domain/notes";
import type { Frontmatter } from "../../domain/notes";
import type { Note } from "./index";

export function copyFrontmatter(value: unknown): Frontmatter {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
  return { ...value };
}

export function recordNotes(notes: readonly Note[]): readonly Note[] {
  return notes
    .filter(({ frontmatter }) => isRecordFrontmatter(frontmatter))
    .toSorted((left, right) => {
      if (left.path < right.path) return -1;
      if (left.path > right.path) return 1;
      return 0;
    });
}
