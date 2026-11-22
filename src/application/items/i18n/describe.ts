import type { ItemIssue } from "../../../domain/items";
import type { Catalog } from "../../messages";
import { describeRecordIssue } from "../../notes";
import type { UserMessage } from "../../shell";
import type { InvalidItemError } from "../errors";
import type { ItemsCatalog } from "./catalog";

export function describeItemIssue(
  issue: ItemIssue,
  messages: Pick<Catalog, "items" | "notes">,
): string {
  return describeRecordIssue(issue, messages.notes, messages.items);
}

export function describeItemsError(_error: InvalidItemError, messages: ItemsCatalog): UserMessage {
  return { severity: "warning", ...messages.form.summary };
}
