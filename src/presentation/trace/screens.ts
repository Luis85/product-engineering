import { PROJECT_TRACE } from "../../application/trace";
import type { ModuleScreens } from "../shell";

export const traceScreens = {
  screens: {
    [PROJECT_TRACE]: () => import("./TraceScreen.vue").then(({ default: screen }) => screen),
  },
  sections: {},
} satisfies ModuleScreens<"trace">;
