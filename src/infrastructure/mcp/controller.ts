import { sharedItemTools } from "../../application/integrations";
import type { LocalMcpServer, McpController } from "../../application/integrations";
import { createLocalMcpServer } from "./local-server";
import { serializeLifecycle } from "./lifecycle-queue";

type McpControllerOptions = {
  readonly version: string;
  readonly readItem: Parameters<typeof sharedItemTools>[0]["readItem"];
};

export function createMcpController({ version, readItem }: McpControllerOptions): McpController {
  let active: LocalMcpServer | undefined;
  let disposed = false;
  const serialize = serializeLifecycle();

  async function stop(): Promise<void> {
    const server = active;
    active = undefined;
    await server?.dispose();
  }

  return {
    start(port, selectedItemIds) {
      const selection = [...selectedItemIds];
      return serialize(async () => {
        if (disposed) throw new Error("The MCP controller was disposed.");
        if (active) return active.start();

        const tools = sharedItemTools({ selectedItemIds: selection, readItem });
        const server = createLocalMcpServer({ version, tools, port });
        const connection = await server.start();
        active = server;
        return connection;
      });
    },
    stop: () => serialize(stop),
    status: () => active?.status() ?? { state: "stopped" },
    connection: () => active?.connection(),
    dispose: () =>
      serialize(async () => {
        disposed = true;
        await stop();
      }),
  };
}
