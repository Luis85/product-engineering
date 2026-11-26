import { itemType } from "../../domain/items";
import { defineModule } from "../module";
import { ITEM_ERROR_TAG_KEYS } from "./errors";
import { de } from "./i18n/de";
import { en } from "./i18n/en";
import { ITEMS_SECTION } from "./routes";
import { itemWritesLayer } from "./use-cases";
import { describeItemsError } from "./user-messages";

export const itemsModule = defineModule({
  name: "items",
  catalog: { en, de },
  errors: { tags: ITEM_ERROR_TAG_KEYS, describe: describeItemsError },
  noteTypes: [itemType],
  services: itemWritesLayer,
  sections: [{ id: ITEMS_SECTION, order: 100 }],
});
