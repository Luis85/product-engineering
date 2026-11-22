import { defineModule } from "../module";
import { de } from "./i18n/de";
import { en } from "./i18n/en";
import { ITEMS_SECTION } from "./routes";

export const itemsModule = defineModule({
  name: "items",
  catalog: { en, de },
  sections: [{ id: ITEMS_SECTION, order: 100 }],
});
