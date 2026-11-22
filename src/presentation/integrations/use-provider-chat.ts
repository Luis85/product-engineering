import { AgentChat } from "../../application/integrations";
import type { ProviderChat } from "../../application/integrations";
import { useService } from "../shell";

export function useProviderChat(): ProviderChat {
  return useService(AgentChat);
}
