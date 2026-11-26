import { Schema } from "effect";
import { defineLocalMcpTool } from "./index";
import type { LocalMcpTool } from "./index";

const itemSchema = Schema.Struct({
  id: Schema.NonEmptyString,
  title: Schema.String,
  status: Schema.Literals(["open", "done"]),
  due: Schema.optionalKey(Schema.String.check(Schema.isPattern(/^\d{4}-\d{2}-\d{2}$/))),
});

export type SharedItem = typeof itemSchema.Type;

type SharedItemToolsOptions = {
  readonly selectedItemIds: readonly string[];
  readonly readItem: (id: string, signal: AbortSignal) => Promise<SharedItem | undefined>;
};

export function sharedItemTools({
  selectedItemIds,
  readItem,
}: SharedItemToolsOptions): readonly LocalMcpTool[] {
  const selected = new Set(selectedItemIds);

  async function readSharedItem(id: string, signal: AbortSignal): Promise<SharedItem | undefined> {
    signal.throwIfAborted();
    if (!selected.has(id)) return undefined;

    const item = await readItem(id, signal);
    signal.throwIfAborted();
    if (item?.id !== id) return undefined;

    const { title, status, due } = item;
    return { id, title, status, ...(due === undefined ? {} : { due }) };
  }

  return [
    defineLocalMcpTool({
      name: "list_items",
      description: "List the available items the user selected to share.",
      readOnly: true,
      inputSchema: Schema.Struct({}),
      outputSchema: Schema.Struct({ items: Schema.Array(itemSchema) }),
      run: async (_input, signal) => {
        const items = await Promise.all([...selected].map((id) => readSharedItem(id, signal)));
        return { success: true, value: { items: items.filter((item) => item !== undefined) } };
      },
    }),
    defineLocalMcpTool({
      name: "get_item",
      description: "Read an item by its ID if the user selected it to share.",
      readOnly: true,
      inputSchema: Schema.Struct({ id: Schema.NonEmptyString }),
      outputSchema: itemSchema,
      run: async ({ id }, signal) => {
        const item = await readSharedItem(id, signal);
        return item
          ? { success: true, value: item }
          : { success: false, message: "Item is not available." };
      },
    }),
  ];
}
