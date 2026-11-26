import { createItem, describeItemIssue, updateItem } from "../../application/items";
import type { ItemRow } from "../../application/items";
import { itemType, validateItem } from "../../domain/items";
import { useRecordForm } from "../notes";
import { useMessages } from "../shell";

type ItemFormOptions = {
  readonly record?: ItemRow;
  readonly rows: () => readonly ItemRow[];
  readonly root: () => HTMLElement | null;
  readonly done: (id: string) => void;
};

function otherTitles(rows: readonly ItemRow[], record: ItemRow | undefined): readonly string[] {
  return rows
    .filter(
      (row) => row.path !== record?.path && (record?.id === undefined || row.id !== record.id),
    )
    .flatMap(({ values }) => (values.title === undefined ? [] : [values.title]));
}

export function useItemForm({ record, rows, root, done }: ItemFormOptions) {
  const messages = useMessages();
  return useRecordForm({
    type: itemType,
    ...(record ? { record } : {}),
    initial: { status: "open" },
    rules: (input, base) =>
      validateItem(input, { loaded: base?.values, others: otherTitles(rows(), base) }).issues,
    create: createItem,
    update: updateItem,
    invalid: "InvalidItemError",
    describe: (issue) => describeItemIssue(issue, messages),
    labels: messages.items.fields,
    summary: messages.items.form.summary,
    root,
    done,
  });
}
