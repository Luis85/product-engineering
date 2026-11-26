import { toNodeHandler } from "@modelcontextprotocol/node";
import type { NodeIncomingMessageLike } from "@modelcontextprotocol/node";
import { McpServer, createMcpHandler } from "@modelcontextprotocol/server";
import type { CallToolResult } from "@modelcontextprotocol/server";
import { Schema } from "effect";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { LocalMcpTool, LocalMcpToolDefinition } from "../../application/integrations";

const maxRequestBodySize = 64 * 1024;

function standardSchema<A>(schema: Schema.Codec<A, unknown>) {
  return Schema.toStandardJSONSchemaV1(
    Schema.toStandardSchemaV1(schema, {
      leafHook: () => "Invalid tool value.",
      checkHook: () => "Invalid tool value.",
    }),
  );
}

function toolError(text: string): CallToolResult {
  return { isError: true, content: [{ type: "text", text }] };
}

async function runTool<Input extends object, Output extends object>(
  tool: LocalMcpToolDefinition<Input, Output>,
  args: Input,
  signal: AbortSignal,
): Promise<CallToolResult> {
  try {
    signal.throwIfAborted();
    const result = await tool.run(args, signal);
    if (!result.success) return toolError(result.message);

    return {
      structuredContent: result.value,
      content: [{ type: "text", text: JSON.stringify(result.value) }],
    };
  } catch {
    return toolError("The tool could not complete the request.");
  }
}

function registerTool<Input extends object, Output extends object>(
  server: McpServer,
  tool: LocalMcpToolDefinition<Input, Output>,
  shutdown: AbortSignal,
  inFlight: Set<Promise<CallToolResult>>,
) {
  server.registerTool(
    tool.name,
    {
      description: tool.description,
      inputSchema: standardSchema(tool.inputSchema),
      outputSchema: standardSchema(tool.outputSchema),
      annotations: { readOnlyHint: tool.readOnly, openWorldHint: false },
    },
    (args, { mcpReq }) => {
      const signal = AbortSignal.any([mcpReq.signal, shutdown]);
      const invocation = runTool(tool, args, signal);
      inFlight.add(invocation);
      return invocation.finally(() => {
        inFlight.delete(invocation);
      });
    },
  );
}

export function createHttpHandler(
  version: string,
  tools: readonly LocalMcpTool[],
  shutdown: AbortSignal,
) {
  const inFlight = new Set<Promise<CallToolResult>>();
  const handler = createMcpHandler(
    () => {
      const server = new McpServer(
        { name: "product-engineering", version },
        { capabilities: { tools: { listChanged: false } } },
      );
      for (const tool of tools) {
        tool.registerWith((definition) => registerTool(server, definition, shutdown, inFlight));
      }
      return server;
    },
    { maxRequestBodySize },
  );

  const handle = toNodeHandler(handler, { maxRequestBodySize });
  return {
    handle: (request: IncomingMessage, response: ServerResponse) =>
      // The SDK handles explicitly undefined method and URL values like absent properties.
      handle(request as NodeIncomingMessageLike, response),
    close: async () => {
      try {
        await handler.close();
      } finally {
        // Legacy requests also have to finish any cleanup before the vault runtime is released.
        await Promise.all(inFlight);
      }
    },
  };
}
