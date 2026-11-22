import type { Frontmatter, FrontmatterPatch } from "../../domain/notes";

export function applyPatch(target: Frontmatter, patch: FrontmatterPatch): Frontmatter {
  const entries = new Map(Object.entries(target));
  const sets = patch.set ?? {};
  for (const key of patch.remove ?? []) {
    if (!Object.hasOwn(sets, key)) entries.delete(key);
  }
  for (const [key, value] of Object.entries(sets)) entries.set(key, value);
  return Object.fromEntries(entries);
}
