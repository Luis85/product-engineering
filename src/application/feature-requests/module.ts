import { featureRequestType } from "../../domain/feature-requests";
import { defineModule } from "../module";
import type { FeatureRequestError } from "./errors";
import { de } from "./i18n/de";
import { en } from "./i18n/en";
import { projectFeatureRequestsSchema, projectReviewsSchema } from "./routes";
import { featureRequestWritesLayer } from "./write";

export const featureRequestsModule = defineModule({
  name: "feature-requests",
  catalog: { en, de },
  routes: [projectFeatureRequestsSchema, projectReviewsSchema],
  noteTypes: [featureRequestType],
  services: featureRequestWritesLayer,
  errors: {
    tags: { FeatureRequestError: true },
    describe: (error: FeatureRequestError, text: typeof en) => ({
      severity: "error",
      title: text.errors[error.reason],
      detail: "",
    }),
  },
});
