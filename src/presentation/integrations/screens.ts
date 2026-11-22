import { AGENT_CHAT } from "../../application/integrations";
import type { ModuleScreens } from "../shell";

export const integrationsScreens = {
  screens: { [AGENT_CHAT]: () => import("./index").then(({ agentChat }) => agentChat) },
  sections: {},
  menu: [
    {
      route: { name: AGENT_CHAT },
      label: (catalog) => catalog.integrations.chat.title,
      icon: "i-lucide-message-square",
    },
  ],
} satisfies ModuleScreens<"integrations">;
