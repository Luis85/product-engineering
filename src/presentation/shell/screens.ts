import type { ModuleScreens } from "./routing";

export const shellScreens = {
  screens: { settings: () => import("./index").then(({ SettingsScreen }) => SettingsScreen) },
  sections: {},
} satisfies ModuleScreens<"shell">;
