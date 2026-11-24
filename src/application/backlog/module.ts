import { Layer } from "effect";
import { backlogType, nfrType } from "../../domain/backlog";
import { defineModule } from "../module";
import { de } from "./i18n/de";
import { en } from "./i18n/en";
import type { BacklogError } from "./model";
import type { NfrError } from "./nfr/model";
import { nfrWritesLayer } from "./nfr/storage";
import { projectBacklogSchema, projectUseCaseSchema } from "./routes";
import { backlogWritesLayer } from "./service";

export const backlogModule = defineModule({
  name: "backlog",
  catalog: { en, de },
  routes: [projectBacklogSchema, projectUseCaseSchema],
  noteTypes: [backlogType, nfrType],
  services: Layer.merge(backlogWritesLayer, nfrWritesLayer),
  errors: {
    tags: { BacklogError: true, NfrError: true },
    describe: (error: BacklogError | NfrError, text: typeof en) => ({
      severity: "error",
      title:
        error._tag === "BacklogError" ? text.errors[error.reason] : text.nfr.errors[error.reason],
      detail: "",
    }),
  },
});
