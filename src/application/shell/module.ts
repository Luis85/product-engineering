import { defineModule } from "../module";
import { de } from "./i18n/de";
import { en } from "./i18n/en";

export const shellModule = defineModule({ name: "shell", catalog: { en, de } });
