import type { ModuleScreens } from "../shell";

export const itemsScreens = {
  screens: {},
  sections: {
    items: {
      label: (catalog) => catalog.items.settings.label,
      component: () => import("./index").then((module) => module.itemsSettings),
    },
  },
} satisfies ModuleScreens<"items">;
