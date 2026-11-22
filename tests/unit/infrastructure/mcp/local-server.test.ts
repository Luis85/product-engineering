import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import type { VersionNegotiationMode } from "@modelcontextprotocol/client";
import { Schema } from "effect";
import { request } from "node:http";
import { describe, expect, it, vi } from "vitest";
import { defineLocalMcpTool, sharedItemTools } from "../../../../src/application/integrations";
import type { LocalMcpToolDefinition, SharedItem } from "../../../../src/application/integrations";
import { createLocalMcpServer } from "../../../../src/infrastructure/mcp";

const maxBodyBytes = 64 * 1024;
const toolRequest = { name: "items-example", arguments: { id: "A-1" } };
type ReadItem = Parameters<typeof sharedItemTools>[0]["readItem"];

function openServer() {
  const inputSchema = Schema.Struct({ id: Schema.String.check(Schema.isMinLength(1)) });
  const outputSchema = Schema.Struct({ id: Schema.String, title: Schema.String });
  type Run = LocalMcpToolDefinition<typeof inputSchema.Type, typeof outputSchema.Type>["run"];
  const run = vi.fn<Run>((input) =>
    Promise.resolve({ success: true as const, value: { id: input.id, title: "Example" } }),
  );
  const tool = defineLocalMcpTool({
    name: "items-example",
    description: "Read an example product engineering item.",
    readOnly: true,
    inputSchema,
    outputSchema,
    run,
  });
  return { run, tool, server: createLocalMcpServer({ version: "0.1.0", tools: [tool] }) };
}

function connect(endpoint: string, token: string, mode: VersionNegotiationMode = "legacy") {
  const client = new Client(
    { name: "product-engineering-test", version: "1" },
    { versionNegotiation: { mode } },
  );
  const transport = new StreamableHTTPClientTransport(new URL(endpoint), {
    requestInit: {
      headers: { Authorization: `Bearer ${token}`, Origin: new URL(endpoint).origin },
    },
  });
  return client.connect(transport).then(() => client);
}

function httpStatus(endpoint: string, headers: Record<string, string> = {}, body?: string) {
  return new Promise<number | undefined>((resolve, reject) => {
    const connection = request(endpoint, { method: "POST", headers }, (response) => {
      response.resume();
      response.once("end", () => resolve(response.statusCode));
      response.once("error", reject);
    });
    connection.once("error", reject);
    connection.end(body);
  });
}

function latch() {
  let release!: () => void;
  const wait = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { wait, release };
}

describe("local MCP server", () => {
  it.each(["legacy", "auto"] as const)(
    "advertises and runs declared tools in %s mode",
    async (mode) => {
      const { run, server } = openServer();
      expect(server.status()).toEqual({ state: "stopped" });
      expect(server.connection()).toBeUndefined();
      const { endpoint, token } = await server.start();
      const client = await connect(endpoint, token, mode);
      try {
        expect(new URL(endpoint).hostname).toBe("127.0.0.1");
        expect(server.status()).toEqual({ state: "running", endpoint });
        expect(server.connection()).toEqual({ endpoint, token });
        expect(await client.listTools()).toMatchObject({
          tools: [
            {
              name: "items-example",
              annotations: { readOnlyHint: true },
              inputSchema: { required: ["id"] },
            },
          ],
        });
        const result = await client.callTool(toolRequest);
        expect(result.structuredContent).toEqual({ id: "A-1", title: "Example" });
        expect(result.content).toContainEqual({
          type: "text",
          text: '{"id":"A-1","title":"Example"}',
        });
        expect(run).toHaveBeenCalledWith({ id: "A-1" }, expect.any(AbortSignal));

        const invalid = await client.callTool({ name: "items-example", arguments: { id: 1 } });
        expect(invalid.isError).toBe(true);
        const missingId = await client.callTool({ name: "items-example", arguments: { id: "" } });
        expect(missingId.isError).toBe(true);
        expect(run).toHaveBeenCalledTimes(1);
      } finally {
        await client.close();
        await server.dispose();
      }
    },
  );

  it("returns expected tool failures and keeps thrown details out of the protocol", async () => {
    const { run, server } = openServer();
    const { endpoint, token } = await server.start();
    const client = await connect(endpoint, token);
    try {
      run.mockResolvedValueOnce({ success: false, message: "Item not found." });
      expect(await client.callTool(toolRequest)).toMatchObject({
        isError: true,
        content: [{ type: "text", text: "Item not found." }],
      });
      run.mockRejectedValueOnce(new Error("Private vault data"));
      expect(await client.callTool(toolRequest)).toMatchObject({
        isError: true,
        content: [{ type: "text", text: "The tool could not complete the request." }],
      });
    } finally {
      await client.close();
      await server.dispose();
    }
  });

  it("rejects missing credentials, a wrong token, and unapproved Host or Origin", async () => {
    const { run, server } = openServer();
    const { endpoint, token } = await server.start();
    const authorization = { Authorization: `Bearer ${token}` };
    try {
      expect(await httpStatus(endpoint)).toBe(401);
      expect(await httpStatus(endpoint, { Authorization: "Bearer wrong" })).toBe(401);
      expect(await httpStatus(endpoint, { ...authorization, Host: "untrusted.invalid" })).toBe(403);
      expect(
        await httpStatus(endpoint, { ...authorization, Origin: "https://untrusted.invalid" }),
      ).toBe(403);
      expect(await httpStatus(`${endpoint}?token=${token}`)).toBe(404);
      expect(
        await httpStatus(
          endpoint,
          {
            ...authorization,
            "Content-Type": "application/json",
            "Content-Length": String(maxBodyBytes + 1),
          },
          "a".repeat(maxBodyBytes + 1),
        ),
      ).toBe(413);
      expect(run).not.toHaveBeenCalled();
    } finally {
      await server.dispose();
    }
  });

  it("stops the listener, rotates credentials on restart, and refuses to restart after disposal", async () => {
    const { server } = openServer();
    const connection = await server.start();
    try {
      const running = await server.start();
      expect(running).toEqual(connection);
      await server.stop();
      await server.stop();
      expect(server.status()).toEqual({ state: "stopped" });
      expect(server.connection()).toBeUndefined();
      await expect(httpStatus(connection.endpoint)).rejects.toThrow(/ECONNREFUSED/);
      const restarted = await server.start();
      expect(restarted.token).not.toBe(connection.token);
      expect(
        await httpStatus(restarted.endpoint, { Authorization: `Bearer ${connection.token}` }),
      ).toBe(401);
    } finally {
      await server.dispose();
    }
    expect(server.status()).toEqual({ state: "stopped" });
    await expect(server.start()).rejects.toThrow("disposed");
  });

  it("signals an in-flight legacy tool, then waits for its cleanup before disposing", async () => {
    const { run, server } = openServer();
    const { endpoint, token } = await server.start();
    const client = await connect(endpoint, token);
    const started = latch();
    const aborted = latch();
    const finish = latch();
    run.mockImplementationOnce(async (_, signal) => {
      signal.addEventListener("abort", aborted.release, { once: true });
      started.release();
      await finish.wait;
      return { success: false, message: "Cancelled." };
    });
    const call = client.callTool(toolRequest).catch(() => undefined);
    let closed = false;
    try {
      await started.wait;
      const stopping = server.dispose().then(() => {
        closed = true;
      });
      await aborted.wait;
      await expect(httpStatus(endpoint)).rejects.toThrow(/ECONNREFUSED/);
      expect(closed).toBe(false);
      finish.release();
      await stopping;
    } finally {
      finish.release();
      await server.dispose();
      await client.close();
      await call;
    }
  });

  it("can retry a busy port and rejects duplicate manifest tool names", async () => {
    const { server, tool } = openServer();
    const { endpoint } = await server.start();
    const retry = createLocalMcpServer({
      version: "0.1.0",
      tools: [tool],
      port: Number(new URL(endpoint).port),
    });
    try {
      expect(() => createLocalMcpServer({ version: "0.1.0", tools: [tool, tool] })).toThrow(
        "unique",
      );
      await expect(retry.start()).rejects.toThrow(/EADDRINUSE/);
      expect(retry.status()).toEqual({ state: "stopped" });
      await server.stop();
      expect((await retry.start()).endpoint).toBe(endpoint);
    } finally {
      await retry.dispose();
      await server.dispose();
    }
  });
});

describe("shared item tools", () => {
  it("lists available selected items in order and uses the latest revision on every read", async () => {
    const records = new Map<string, SharedItem & { readonly path: string; readonly body: string }>([
      [
        "item-first",
        {
          id: "item-first",
          title: "First",
          status: "open",
          path: "First.md",
          body: "Private body",
        },
      ],
      [
        "item-second",
        {
          id: "item-second",
          title: "Second",
          status: "done",
          due: "2026-12-01",
          path: "Second.md",
          body: "Private body",
        },
      ],
      [
        "item-unselected",
        {
          id: "item-unselected",
          title: "Hidden",
          status: "done",
          path: "Hidden.md",
          body: "Hidden body",
        },
      ],
    ]);
    const readItem = vi.fn<ReadItem>((id, signal) => {
      signal.throwIfAborted();
      return Promise.resolve(records.get(id));
    });
    const selectedItemIds = ["item-second", "item-missing", "item-first", "item-second"];
    const tools = sharedItemTools({ selectedItemIds, readItem });
    selectedItemIds.push("item-unselected");
    const server = createLocalMcpServer({ version: "0.1.0", tools });
    const { endpoint, token } = await server.start();
    const client = await connect(endpoint, token, "auto");
    const listItems = { name: "list_items", arguments: {} };
    const getFirst = { name: "get_item", arguments: { id: "item-first" } };
    try {
      expect(await client.listTools()).toMatchObject({
        tools: [
          { name: "list_items", annotations: { readOnlyHint: true } },
          { name: "get_item", annotations: { readOnlyHint: true } },
        ],
      });
      const listed = await client.callTool(listItems);
      const exposed = {
        items: [
          { id: "item-second", title: "Second", status: "done", due: "2026-12-01" },
          { id: "item-first", title: "First", status: "open" },
        ],
      };
      expect(listed.structuredContent).toEqual(exposed);
      expect(listed.content).toEqual([{ type: "text", text: JSON.stringify(exposed) }]);
      expect(readItem.mock.calls.map(([id]) => id)).toEqual([
        "item-second",
        "item-missing",
        "item-first",
      ]);
      expect(readItem).toHaveBeenCalledWith("item-first", expect.any(AbortSignal));
      expect((await client.callTool(getFirst)).structuredContent).toEqual({
        id: "item-first",
        title: "First",
        status: "open",
      });

      records.set("item-first", {
        id: "item-first",
        title: "Renamed",
        status: "done",
        path: "Renamed.md",
        body: "Updated private body",
      });
      const revised = { id: "item-first", title: "Renamed", status: "done" };
      expect((await client.callTool(getFirst)).structuredContent).toEqual(revised);
      expect((await client.callTool(listItems)).structuredContent).toMatchObject({
        items: [{ id: "item-second" }, revised],
      });
    } finally {
      await client.close();
      await server.dispose();
    }
  });

  it("gives missing, unselected, and mismatched records the same unavailable result", async () => {
    const hidden = { id: "item-unselected", title: "Hidden", status: "open" } as const;
    const readItem = vi.fn<ReadItem>((id, signal) => {
      signal.throwIfAborted();
      return Promise.resolve(id === "item-missing" ? undefined : hidden);
    });
    const tools = sharedItemTools({ selectedItemIds: ["item-missing", "item-mismatch"], readItem });
    const server = createLocalMcpServer({ version: "0.1.0", tools });
    const { endpoint, token } = await server.start();
    const client = await connect(endpoint, token);
    try {
      const getItem = (id: string) => client.callTool({ name: "get_item", arguments: { id } });
      const unavailable = await getItem("item-missing");
      expect(unavailable.isError).toBe(true);
      expect(unavailable.content).toEqual([{ type: "text", text: "Item is not available." }]);
      expect(await getItem("item-unselected")).toEqual(unavailable);
      expect(await getItem("item-mismatch")).toEqual(unavailable);
      expect(readItem.mock.calls.map(([id]) => id)).toEqual(["item-missing", "item-mismatch"]);
      expect(
        (await client.callTool({ name: "list_items", arguments: {} })).structuredContent,
      ).toEqual({ items: [] });
    } finally {
      await client.close();
      await server.dispose();
    }
  });

  it("passes listener shutdown to the reader of a selected item", async () => {
    const started = latch();
    const finish = latch();
    const readItem = vi.fn<ReadItem>(async () => {
      started.release();
      await finish.wait;
      return { id: "item-first", title: "First", status: "open" };
    });
    const tools = sharedItemTools({ selectedItemIds: ["item-first"], readItem });
    const server = createLocalMcpServer({ version: "0.1.0", tools });
    const { endpoint, token } = await server.start();
    const client = await connect(endpoint, token);
    const call = client
      .callTool({ name: "get_item", arguments: { id: "item-first" } })
      .catch(() => undefined);
    try {
      await started.wait;
      const closing = server.dispose();
      await expect(httpStatus(endpoint)).rejects.toThrow(/ECONNREFUSED/);
      expect(readItem.mock.calls[0]?.[1].aborted).toBe(true);
      finish.release();
      await closing;
    } finally {
      finish.release();
      await server.dispose();
      await client.close();
      await call;
    }
  });
});
