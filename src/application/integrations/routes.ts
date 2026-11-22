import { Schema } from "effect";

export const AGENT_CHAT = "agent-chat";
export const agentChatRoute = Schema.Struct({ name: Schema.Literal(AGENT_CHAT) });
