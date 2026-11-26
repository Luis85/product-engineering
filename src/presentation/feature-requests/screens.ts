import { PROJECT_FEATURE_REQUESTS, PROJECT_REVIEWS } from "../../application/feature-requests";
import type { ModuleScreens } from "../shell";

export const featureRequestsScreens = {
  screens: {
    [PROJECT_FEATURE_REQUESTS]: () =>
      import("./FeatureRequestsScreen.vue").then((module) => module.default),
    [PROJECT_REVIEWS]: () => import("./ReviewsScreen.vue").then((module) => module.default),
  },
  sections: {},
} satisfies ModuleScreens<"feature-requests">;
