import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { once } from "node:events";
import { connect } from "node:net";
import { expect, it, vi } from "vitest";
import type { LocalMcpConnection, SharedItem } from "../../../../src/application/integrations";
import { createLocalMcpServer, createMcpController } from "../../../../src/infrastructure/mcp";

async function listItems({ endpoint, token }: LocalMcpConnection): Promise<unknown> {
  const client = new Client({ name: "controller-test", version: "1" });
  try {
    await client.connect(
      new StreamableHTTPClientTransport(new URL(endpoint), {
        requestInit: { headers: { Authorization: `Bearer ${token}` } },
      }),
    );
    return (await client.callTool({ name: "list_items", arguments: {} })).structuredContent;
  } finally {
    await client.close();
  }
}

function controllerFixture() {
  const records = new Map<string, SharedItem>([
    ["item-first", { id: "item-first", title: "First", status: "open" }],
    ["item-second", { id: "item-second", title: "Second", status: "done" }],
  ]);
  const readItem = vi.fn<(id: string, signal: AbortSignal) => Promise<SharedItem | undefined>>(
    (id, signal) => {
      signal.throwIfAborted();
      return Promise.resolve(records.get(id));
    },
  );
  return { controller: createMcpController({ version: "0.1.0", readItem }), readItem };
}

it("snapshots sharing and the port at start, reuses the listener, and applies new settings after stop", async () => {
  const { controller } = controllerFixture();
  const reserved = createLocalMcpServer({ version: "0.1.0", tools: [] });
  try {
    const reservation = await reserved.start();
    const newPort = Number(new URL(reservation.endpoint).port);
    const selection = ["item-first"];
    const starting = controller.start(0, selection);
    selection.push("item-second");
    const repeating = controller.start(newPort, ["item-second"]);
    const [first, repeated] = await Promise.all([starting, repeating]);

    expect(repeated).toEqual(first);
    expect(controller.connection()).toEqual(first);
    expect(controller.status()).toEqual({ state: "running", endpoint: first.endpoint });
    expect(await listItems(first)).toEqual({
      items: [{ id: "item-first", title: "First", status: "open" }],
    });

    await controller.stop();
    await controller.stop();
    expect(controller.connection()).toBeUndefined();
    expect(controller.status()).toEqual({ state: "stopped" });
    await reserved.stop();
    const restarted = await controller.start(newPort, ["item-second"]);
    expect(restarted.endpoint).toBe(reservation.endpoint);
    expect(restarted.token).not.toBe(first.token);
    expect(await listItems(restarted)).toEqual({
      items: [{ id: "item-second", title: "Second", status: "done" }],
    });
  } finally {
    await Promise.all([controller.dispose(), reserved.dispose()]);
  }
});

it("recovers from a failed bind and returns an empty list with no selected items", async () => {
  const { controller, readItem } = controllerFixture();
  const reserved = createLocalMcpServer({ version: "0.1.0", tools: [] });
  try {
    const reservation = await reserved.start();
    const busyPort = Number(new URL(reservation.endpoint).port);
    await expect(controller.start(busyPort, ["item-first"])).rejects.toThrow(/EADDRINUSE/);
    expect(controller.status()).toEqual({ state: "stopped" });
    expect(controller.connection()).toBeUndefined();

    await reserved.stop();
    const connection = await controller.start(busyPort, []);
    expect(connection.endpoint).toBe(reservation.endpoint);
    expect(await listItems(connection)).toEqual({ items: [] });
    expect(readItem).not.toHaveBeenCalled();
  } finally {
    await Promise.all([controller.dispose(), reserved.dispose()]);
  }
});

it("serializes disposal behind a pending start and closes the newly bound listener", async () => {
  const { controller } = controllerFixture();
  const startup = controller.start(0, ["item-first"]);
  const shutdown = controller.dispose();
  try {
    const [connection] = await Promise.all([startup, shutdown]);
    expect(controller.status()).toEqual({ state: "stopped" });
    expect(controller.connection()).toBeUndefined();
    const address = new URL(connection.endpoint);
    const socket = connect(Number(address.port), address.hostname);
    try {
      await expect(once(socket, "connect")).rejects.toThrow(/ECONNREFUSED/);
    } finally {
      socket.destroy();
    }
    await expect(controller.start(0, [])).rejects.toThrow("disposed");
  } finally {
    await controller.dispose();
  }
});
