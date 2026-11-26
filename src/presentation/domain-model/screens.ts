import { PROJECT_DOMAIN_MODEL } from "../../application/domain-model";
import type { ModuleScreens } from "../shell";

export const domainModelScreens = {
  screens: {
    [PROJECT_DOMAIN_MODEL]: () =>
      import("./DomainModelScreen.vue").then((module) => module.default),
  },
  sections: {},
} satisfies ModuleScreens<"domain-model">;
