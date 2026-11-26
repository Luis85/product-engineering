import { Context, Effect, Layer, Semaphore } from "effect";
import { itemType, validateItem } from "../../domain/items";
import type { ItemValues } from "../../domain/items";
import type { FormInput } from "../../domain/notes";
import { NoteStore } from "../notes";
import { InvalidItemError } from "./errors";
import { itemRecords } from "./list";
import type { ItemRow } from "./list";

class ItemWrites extends Context.Service<ItemWrites, Semaphore.Semaphore>()(
  "product-engineering/application/ItemWrites",
) {}

export const itemWritesLayer = Layer.effect(ItemWrites, Semaphore.make(1));

function withWritePermit<A, E, R>(effect: Effect.Effect<A, E, R>) {
  return ItemWrites.use((lock) => Semaphore.withPermit(lock)(effect));
}

function otherTitles(id: string | undefined) {
  return NoteStore.use((store) =>
    Effect.map(store.list, (notes) =>
      notes.flatMap((note) => {
        if (id !== undefined && note.frontmatter.id === id) return [];
        const decoded = itemType.decode(note);
        return decoded.kind === "not-this-type" || decoded.values.title === undefined
          ? []
          : [decoded.values.title];
      }),
    ),
  );
}

function checkedValues(input: FormInput, loaded?: ItemValues, id?: string) {
  return Effect.gen(function* () {
    const others = yield* otherTitles(id);
    const { values, issues } = validateItem(input, { others, loaded });
    if (issues.length > 0) return yield* new InvalidItemError({ issues });
    return values;
  });
}

export function createItem(input: FormInput) {
  return withWritePermit(Effect.flatMap(checkedValues(input), itemRecords.create));
}

export function updateItem(row: ItemRow, input: FormInput) {
  return withWritePermit(
    Effect.flatMap(checkedValues(input, row.values, row.id), (values) =>
      itemRecords.update(row, values),
    ),
  );
}

export function deleteItem(row: ItemRow) {
  return withWritePermit(itemRecords.remove(row));
}
