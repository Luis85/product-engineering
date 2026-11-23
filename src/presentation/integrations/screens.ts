import { AGENT_CHAT } from "../../application/integrations";
import type { ModuleScreens } from "../shell";

const chat = () => import("./index").then((module) => module.agentChat);

export const integrationsScreens = {
  screens: { [AGENT_CHAT]: chat },
  context: chat,
  sections: {},
} satisfies ModuleScreens<"integrations">;
