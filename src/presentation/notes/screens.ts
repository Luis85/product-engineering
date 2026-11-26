import type { ModuleScreens } from "../shell";

export const notesScreens = {
  screens: {},
  sections: {
    [DATA_ISSUES_SECTION]: {
      label: (catalog) => catalog.notes.unindexed.label,
      component: () =>
        import("./components/DataIssues.vue").then(({ default: component }) => component),
      badge: () =>
        import("./components/DataIssuesBadge.vue").then(({ default: component }) => component),
    },
  },
} satisfies ModuleScreens<"notes">;
import { DATA_ISSUES_SECTION } from "../../application/notes";
