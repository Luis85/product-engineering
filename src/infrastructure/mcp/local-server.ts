import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { createServer } from "node:http";
import type { IncomingMessage, Server, ServerResponse } from "node:http";
import type {
  LocalMcpConnection,
  LocalMcpServer,
  LocalMcpServerStatus,
  LocalMcpTool,
} from "../../application/integrations";
import { serializeLifecycle } from "./lifecycle-queue";

const host = "127.0.0.1";
const path = "/mcp";

type LocalMcpServerOptions = {
  readonly version: string;
  readonly tools: readonly LocalMcpTool[];
  readonly port?: number;
};

type Listener = {
  readonly connection: LocalMcpConnection;
  readonly close: () => Promise<void>;
};

function digest(value: string): Buffer {
  return createHash("sha256").update(value).digest();
}

function rejectRequest(response: ServerResponse, status: number, message: string) {
  response
    .writeHead(status, {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      Connection: "close",
      ...(status === 401 ? { "WWW-Authenticate": "Bearer" } : {}),
    })
    .end(message);
}

function authorize(
  request: IncomingMessage,
  response: ServerResponse,
  tokenDigest: Buffer,
): boolean {
  const authority = `${host}:${request.socket.localPort}`;
  const { host: authorityHeader, origin, authorization } = request.headers;
  if (authorityHeader !== authority || (origin !== undefined && origin !== `http://${authority}`)) {
    rejectRequest(response, 403, "Forbidden");
    return false;
  }

  if (request.url !== path) {
    rejectRequest(response, 404, "Not found");
    return false;
  }

  const credential = /^Bearer ([A-Za-z0-9_-]{43})$/i.exec(authorization ?? "")?.[1];
  if (credential === undefined || !timingSafeEqual(digest(credential), tokenDigest)) {
    rejectRequest(response, 401, "Unauthorized");
    return false;
  }

  return true;
}

function listen(server: Server, port: number): Promise<number> {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => {
      server.off("error", reject);
      const address = server.address();
      if (address === null || typeof address === "string") {
        reject(new Error("The MCP server has no TCP listener."));
        return;
      }

      resolve(address.port);
    });
  });
}

function closeHttp(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) reject(error);
      else resolve();
    });
    server.closeAllConnections();
  });
}

async function startListener(
  version: string,
  tools: readonly LocalMcpTool[],
  port: number,
): Promise<Listener> {
  const { createHttpHandler } = await import("./handler");
  const token = randomBytes(32).toString("base64url");
  const tokenDigest = digest(token);
  const shutdown = new AbortController();
  const handler = createHttpHandler(version, tools, shutdown.signal);
  const server = createServer(
    { headersTimeout: 10_000, requestTimeout: 10_000 },
    (request, response) => {
      response.setHeader("Cache-Control", "no-store");
      if (authorize(request, response, tokenDigest)) {
        void handler.handle(request, response).catch(() => {
          if (response.headersSent) response.destroy();
          else rejectRequest(response, 500, "MCP request failed");
        });
      }
    },
  );

  try {
    const boundPort = await listen(server, port);
    return {
      connection: Object.freeze({ endpoint: `http://${host}:${boundPort}${path}`, token }),
      close: async () => {
        shutdown.abort();
        try {
          await closeHttp(server);
        } finally {
          await handler.close();
        }
      },
    };
  } catch (error) {
    if (server.listening) await closeHttp(server);
    await handler.close();
    throw error;
  }
}

export function createLocalMcpServer({
  version,
  tools,
  port = 0,
}: LocalMcpServerOptions): LocalMcpServer {
  const registered = [...tools];
  if (new Set(registered.map(({ name }) => name)).size !== registered.length) {
    throw new Error("MCP tool names must be unique.");
  }

  let listener: Listener | undefined;
  let disposed = false;
  const serialize = serializeLifecycle();

  async function stop(): Promise<void> {
    const running = listener;
    listener = undefined;
    await running?.close();
  }

  return {
    start: () =>
      serialize(async () => {
        if (disposed) throw new Error("The MCP server was disposed.");
        listener ??= await startListener(version, registered, port);
        return listener.connection;
      }),
    stop: () => serialize(stop),
    connection: () => listener?.connection,
    status: (): LocalMcpServerStatus =>
      listener
        ? { state: "running", endpoint: listener.connection.endpoint }
        : { state: "stopped" },
    dispose: () =>
      serialize(async () => {
        disposed = true;
        await stop();
      }),
  };
}
