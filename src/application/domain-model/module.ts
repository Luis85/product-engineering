import { defineModule } from "../module";
import { domainWritesLayer } from "./entities";
import type { DomainModelError } from "./errors";
import { de } from "./i18n/de";
import { en } from "./i18n/en";
import { projectDomainModelSchema } from "./routes";

export const domainModelModule = defineModule({
  name: "domain-model",
  catalog: { en, de },
  routes: [projectDomainModelSchema],
  services: domainWritesLayer,
  errors: {
    tags: { DomainModelError: true },
    describe: (error: DomainModelError, text: typeof en) => ({
      severity: "error",
      title: text.errors[error.reason],
      detail: "",
    }),
  },
});
