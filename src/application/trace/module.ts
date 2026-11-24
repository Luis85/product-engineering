import { defineModule } from "../module";
import { de } from "./i18n/de";
import { en } from "./i18n/en";
import { projectTraceSchema } from "./routes";

export const traceModule = defineModule({
  name: "trace",
  catalog: { en, de },
  routes: [projectTraceSchema],
});
