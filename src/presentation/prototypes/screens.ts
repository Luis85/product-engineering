import { PROJECT_PROTOTYPES } from "../../application/prototypes";
import type { ModuleScreens } from "../shell";

export const prototypesScreens = {
  screens: {
    [PROJECT_PROTOTYPES]: () => import("./PrototypesScreen.vue").then((module) => module.default),
  },
  sections: {},
} satisfies ModuleScreens<"prototypes">;
