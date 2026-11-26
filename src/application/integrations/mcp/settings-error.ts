import { Schema } from "effect";

const McpSettingsAction = Schema.Literals(["start", "stop", "copy"]);
export type McpSettingsAction = typeof McpSettingsAction.Type;

export class McpSettingsError extends Schema.TaggedError<McpSettingsError>()("McpSettingsError", {
  action: McpSettingsAction,
}) {}
