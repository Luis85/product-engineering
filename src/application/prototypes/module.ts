import { prototypeType } from "../../domain/prototypes";
import { defineModule } from "../module";
import type { PrototypeError } from "./errors";
import { de } from "./i18n/de";
import { en } from "./i18n/en";
import { projectPrototypesSchema } from "./routes";
import { prototypeWritesLayer } from "./write";

export const prototypesModule = defineModule({
  name: "prototypes",
  catalog: { en, de },
  routes: [projectPrototypesSchema],
  noteTypes: [prototypeType],
  services: prototypeWritesLayer,
  errors: {
    tags: { PrototypeError: true },
    describe: (error: PrototypeError, text: typeof en) => ({
      severity: "error",
      title: text.errors[error.reason],
      detail: "",
    }),
  },
});
