import { backlogType } from "../../domain/backlog";
import { defineModule } from "../module";
import { de } from "./i18n/de";
import { en } from "./i18n/en";
import type { BacklogError } from "./model";
import { projectBacklogSchema, projectUseCaseSchema } from "./routes";
import { backlogWritesLayer } from "./service";

export const backlogModule = defineModule({
  name: "backlog",
  catalog: { en, de },
  routes: [projectBacklogSchema, projectUseCaseSchema],
  noteTypes: [backlogType],
  services: backlogWritesLayer,
  errors: {
    tags: { BacklogError: true },
    describe: (error: BacklogError, text: typeof en) => ({
      severity: "error",
      title: text.errors[error.reason],
      detail: "",
    }),
  },
});
