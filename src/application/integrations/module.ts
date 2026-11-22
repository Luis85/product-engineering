import { defineModule } from "../module";
import { describeIntegrationError } from "./i18n/catalog";
import { de } from "./i18n/de";
import { en } from "./i18n/en";
import { agentChatRoute } from "./routes";

export const integrationsModule = defineModule({
  name: "integrations",
  routes: [agentChatRoute],
  catalog: { en, de },
  errors: {
    tags: { ProviderChatError: true, McpSettingsError: true },
    describe: describeIntegrationError,
  },
});
