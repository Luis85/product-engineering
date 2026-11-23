import { knowledgeType } from "../../domain/knowledge";
import { defineModule } from "../module";
import { knowledgeWritesLayer } from "./create";
import type { KnowledgeCreateError, KnowledgeEditError } from "./errors";
import { de } from "./i18n/de";
import { en } from "./i18n/en";
import { projectKnowledgeSchema } from "./routes";

export const knowledgeModule = defineModule({
  name: "knowledge",
  catalog: { en, de },
  routes: [projectKnowledgeSchema],
  noteTypes: [knowledgeType],
  services: knowledgeWritesLayer,
  errors: {
    tags: { KnowledgeCreateError: true, KnowledgeEditError: true },
    describe: (error: KnowledgeCreateError | KnowledgeEditError, text: typeof en) => ({
      severity: "error",
      title:
        error._tag === "KnowledgeEditError"
          ? text.note.fieldErrors[error.reason]
          : text.errors[error.reason],
      detail: "",
    }),
  },
});
