import { duplicateTitles, fallbackItemName, itemType } from "../../domain/items";
import type { DuplicateTitleIssue } from "../../domain/items";
import { clashKey } from "../../domain/notes";
import { defineRecords } from "../notes";
import type { RecordRow } from "../notes";

type ItemFields = typeof itemType.fields;
export type ItemRow = RecordRow<ItemFields, DuplicateTitleIssue>;

const duplicateIssue = { key: "title", code: "title.duplicate" } as const;

function markDuplicateTitles(rows: readonly ItemRow[]): readonly ItemRow[] {
  const titles = rows.flatMap(({ values: { title } }) => (title === undefined ? [] : [title]));
  const duplicates = duplicateTitles(titles);
  if (duplicates.size === 0) return rows;
  return rows.map((row) => {
    const { title } = row.values;
    return title !== undefined && duplicates.has(clashKey(title))
      ? { ...row, issues: [...row.issues, duplicateIssue] }
      : row;
  });
}

export const itemRecords = defineRecords<ItemFields, DuplicateTitleIssue>({
  type: itemType,
  title: "title",
  fallbackName: fallbackItemName,
  log: "items",
  between: markDuplicateTitles,
});

export const itemList = itemRecords.list;
export const itemChanges = itemRecords.changes;
export const shownItemName = itemRecords.shownName;
