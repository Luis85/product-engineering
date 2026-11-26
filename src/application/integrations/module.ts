import { copilotType } from "../../domain/integrations";
import { defineModule } from "../module";
import { copilotWritesLayer } from "./chat/conversations";
import { describeIntegrationError } from "./i18n/catalog";
import { de } from "./i18n/de";
import { en } from "./i18n/en";
import { agentChatRoute } from "./routes";

export const integrationsModule = defineModule({
  name: "integrations",
  routes: [agentChatRoute],
  noteTypes: [copilotType],
  services: copilotWritesLayer,
  catalog: { en, de },
  errors: {
    tags: { ProviderChatError: true, McpSettingsError: true },
    describe: describeIntegrationError,
  },
});
