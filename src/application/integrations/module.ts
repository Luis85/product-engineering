import { defineModule } from "../module";
import { describeProviderChatError } from "./i18n/catalog";
import { de } from "./i18n/de";
import { en } from "./i18n/en";

export const integrationsModule = defineModule({
  name: "integrations",
  catalog: { en, de },
  errors: {
    tags: { ProviderChatError: true },
    describe: describeProviderChatError,
  },
});
