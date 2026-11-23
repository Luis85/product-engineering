import { knowledgeType } from "../../domain/knowledge";
import { defineModule } from "../module";
import { knowledgeWritesLayer } from "./create";
import type { KnowledgeCreateError } from "./errors";
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
    tags: { KnowledgeCreateError: true },
    describe: (error: KnowledgeCreateError, text: typeof en) => ({
      severity: "error",
      title: text.errors[error.reason],
      detail: "",
    }),
  },
});
