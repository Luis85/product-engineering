import type { Schema } from "effect";

type LocalMcpToolResult<Output extends object> =
  | { readonly success: true; readonly value: Output }
  | { readonly success: false; readonly message: string };

export type LocalMcpToolDefinition<Input extends object, Output extends object> = {
  readonly name: string;
  readonly description: string;
  readonly readOnly: boolean;
  readonly inputSchema: Schema.Codec<Input, unknown>;
  readonly outputSchema: Schema.Codec<Output>;
  readonly run: (input: Input, signal: AbortSignal) => Promise<LocalMcpToolResult<Output>>;
};

type RegisterTool = <Input extends object, Output extends object>(
  definition: LocalMcpToolDefinition<Input, Output>,
) => void;

export type LocalMcpTool = {
  readonly name: string;
  readonly registerWith: (register: RegisterTool) => void;
};

export function defineLocalMcpTool<Input extends object, Output extends object>(
  definition: LocalMcpToolDefinition<Input, Output>,
): LocalMcpTool {
  return {
    name: definition.name,
    registerWith: (register) => register(definition),
  };
}

export type LocalMcpConnection = {
  readonly endpoint: string;
  readonly token: string;
};

export type LocalMcpServerStatus =
  { readonly state: "stopped" } | { readonly state: "running"; readonly endpoint: string };

export type LocalMcpServer = {
  readonly start: () => Promise<LocalMcpConnection>;
  readonly stop: () => Promise<void>;
  readonly connection: () => LocalMcpConnection | undefined;
  readonly status: () => LocalMcpServerStatus;
  readonly dispose: () => Promise<void>;
};

export type McpController = Omit<LocalMcpServer, "start"> & {
  readonly start: (port: number, selectedItemIds: readonly string[]) => Promise<LocalMcpConnection>;
};
