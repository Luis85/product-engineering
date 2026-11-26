export { chatFailureOf, isChatFailure, ProviderChatError } from "./chat";
export type { ChatFailure, ChatMessage, ChatProvider, ChatRequest, ProviderChat } from "./chat";
export { aiCapability, sameAiCapability } from "./chat/capability";
export { scopedChatMessages } from "./chat/context";
export { copilotRouteSource, copilotSourceChanges } from "./chat/sources";
export type { CopilotSource } from "./chat/sources";
export { applyCopilotProposal, prepareCopilotProposal } from "./chat/proposals";
export type { CopilotProposal } from "./chat/proposals";
export { loadCopilot, newCopilotThreadId, saveCopilot } from "./chat/conversations";
export {
  AgentChat,
  configuredAgentChat,
  deterministicDemoChat,
  unavailableAgentChat,
} from "./chat/service";
export type { IntegrationsCatalog } from "./i18n/catalog";
export { defineLocalMcpTool } from "./mcp";
export type {
  LocalMcpConnection,
  LocalMcpServer,
  LocalMcpServerStatus,
  LocalMcpTool,
  LocalMcpToolDefinition,
  McpController,
} from "./mcp";
export { McpSettingsError } from "./mcp/settings-error";
export { sharedItemTools } from "./mcp/shared-item-tools";
export type { SharedItem } from "./mcp/shared-item-tools";
export { projectMcpToolName, projectReadTool } from "./mcp/project-tool";
export type { ProjectMcpCandidate, ProjectMcpProbe, ReadMcpProject } from "./mcp/project-tool";
export { integrationsModule } from "./module";
export { AGENT_CHAT } from "./routes";
