import { ITEMS_SECTION } from "../../application/items";
import type { ModuleScreens } from "../shell";

export const itemsScreens = {
  screens: {},
  sections: {
    [ITEMS_SECTION]: {
      label: (catalog) => catalog.items.settings.label,
      component: () => import("./index").then((module) => module.itemsSettings),
    },
  },
} satisfies ModuleScreens<"items">;
