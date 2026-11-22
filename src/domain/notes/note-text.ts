import type { Frontmatter } from "./note-type";
import { yamlEntry } from "./yaml-text";

export function newNoteText(frontmatter: Frontmatter, body = ""): string {
  const entries = Object.entries(frontmatter).flatMap(([key, value]) =>
    value === undefined ? [] : [yamlEntry(key, value, "\n")],
  );
  return entries.length > 0 ? "---\n" + entries.join("") + "---\n" + body : body;
}
