import { Layer } from "effect";
import { backlogType, deliverableType, nfrType } from "../../domain/backlog";
import { defineModule } from "../module";
import { deliverableOriginsLayer } from "./deliverables/knowledge";
import { deliverableWritesLayer } from "./deliverables/storage";
import type { DeliverableError } from "./deliverables/storage";
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
  noteTypes: [backlogType, nfrType, deliverableType],
  services: Layer.mergeAll(
    backlogWritesLayer,
    nfrWritesLayer,
    deliverableWritesLayer,
    deliverableOriginsLayer,
  ),
  errors: {
    tags: { BacklogError: true, NfrError: true, DeliverableError: true },
    describe: (error: BacklogError | NfrError | DeliverableError, text: typeof en) => ({
      severity: "error",
      title:
        error._tag === "BacklogError"
          ? text.errors[error.reason]
          : error._tag === "NfrError"
            ? text.nfr.errors[error.reason]
            : text.deliverables.errors[error.reason],
      detail: "",
    }),
  },
});
