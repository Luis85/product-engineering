import { clashKey, editedValues, fitsFileName, trimmedValues } from "../notes";
import type { FormInput } from "../notes";
import { itemType } from "./item-type";
import type { ItemFieldIssue, ItemValues } from "./item-type";

export const fallbackItemName = () => "Item";

type ItemValidationOptions = {
  readonly others: readonly string[];
  readonly loaded?: ItemValues | undefined;
};

function titleIssue(title: string, others: readonly string[]): ItemFieldIssue | undefined {
  if (!fitsFileName(title, fallbackItemName())) return { key: "title", code: "title.too-long" };
  const name = clashKey(title);
  if (others.some((other) => clashKey(other) === name))
    return { key: "title", code: "title.taken" };
}

export function validateItem(
  input: FormInput,
  { others, loaded }: ItemValidationOptions,
): { readonly values: ItemValues; readonly issues: readonly ItemFieldIssue[] } {
  const normalized =
    loaded === undefined ? trimmedValues(input) : editedValues(itemType, input, loaded, loaded);
  const checked = itemType.check(normalized);
  const title = checked.values.title;
  if (title === undefined || title === loaded?.title) return checked;
  const issue = titleIssue(title, others);
  return issue === undefined ? checked : { ...checked, issues: [...checked.issues, issue] };
}

export function duplicateTitles(titles: readonly string[]): ReadonlySet<string> {
  const seen = new Set<string>();
  const repeated = new Set<string>();
  for (const title of titles) {
    const key = clashKey(title);
    if (seen.has(key)) repeated.add(key);
    else seen.add(key);
  }
  return repeated;
}
