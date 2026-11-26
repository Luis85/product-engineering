import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { Effect, Stream } from "effect";
import { expect, it } from "vitest";
import type { LocalMcpConnection } from "../../../../src/application/integrations";
import { SettingsService } from "../../../../src/application/shell";
import { createMcpController } from "../../../../src/infrastructure/mcp";
import { createMcpItemAccess } from "../../../../src/infrastructure/obsidian/integrations/mcp-items";
import type { McpItemSnapshot } from "../../../../src/infrastructure/obsidian/integrations/mcp-items";
import { testRuntime } from "../../../support/runtime";

const first = {
  id: "item-00000000-0000-0000-0000-000000000001",
  title: "Shared",
  status: "open",
} as const;
const second = {
  id: "item-00000000-0000-0000-0000-000000000002",
  title: "Private",
  status: "done",
} as const;

function indexedItem({ id, ...values }: typeof first | typeof second) {
  return {
    kind: "editable" as const,
    id,
    values,
    path: "Private/Notes.md",
    frontmatter: { extra: "Private note instructions" },
  };
}

async function connect(connection: LocalMcpConnection): Promise<Client> {
  const client = new Client({ name: "mcp-item-access-test", version: "1" });
  await client.connect(
    new StreamableHTTPClientTransport(new URL(connection.endpoint), {
      requestInit: { headers: { Authorization: `Bearer ${connection.token}` } },
    }),
  );
  return client;
}

function listItems(client: Client) {
  return client.callTool({ name: "list_items", arguments: {} });
}

function getItem(client: Client, id: string) {
  return client.callTool({ name: "get_item", arguments: { id } });
}

it("limits real MCP calls to loaded item data and the configured start scope, then revokes access", async () => {
  const fixture = testRuntime({ initialSettings: { mcpSharedItemIds: [first.id] } });
  const initial: McpItemSnapshot = {
    ready: true,
    failure: undefined,
    notes: [indexedItem(first), indexedItem(second)],
  };
  let current: McpItemSnapshot = initial;
  const access = createMcpItemAccess(fixture.runtime, {
    current: Effect.sync(() => current),
    changes: Stream.empty,
  });
  const controller = createMcpController({ version: "1", readItem: access.readItem });
  try {
    const client = await connect(await controller.start(0, [first.id]));
    try {
      expect((await listItems(client)).structuredContent).toEqual({ items: [first] });
      const denied = await getItem(client, second.id);
      expect(denied).toMatchObject({
        isError: true,
        content: [{ type: "text", text: "Item is not available." }],
      });
      expect((await getItem(client, first.id)).structuredContent).toEqual(first);

      current = {
        ...initial,
        notes: [
          {
            ...indexedItem(first),
            values: { title: "Outside revision", status: "done", due: "2026-12-01" },
          },
          indexedItem(second),
        ],
      };
      expect((await getItem(client, first.id)).structuredContent).toEqual({
        id: first.id,
        title: "Outside revision",
        status: "done",
        due: "2026-12-01",
      });

      current = { ...initial, failure: new Error("Index unavailable") };
      expect((await listItems(client)).structuredContent).toEqual({ items: [] });
      current = {
        ...initial,
        notes: [{ ...indexedItem(first), kind: "read-only" }, indexedItem(second)],
      };
      expect(await getItem(client, first.id)).toMatchObject({
        isError: true,
        content: denied.content,
      });
      current = initial;
      await fixture.runtime.runPromise(
        SettingsService.use((settings) => settings.update({ mcpSharedItemIds: [second.id] })),
      );
      expect((await listItems(client)).structuredContent).toEqual({ items: [] });
      expect(await getItem(client, first.id)).toMatchObject({
        isError: true,
        content: denied.content,
      });
    } finally {
      await client.close();
    }

    await controller.stop();
    const restarted = await connect(await controller.start(0, [second.id]));
    try {
      expect((await listItems(restarted)).structuredContent).toEqual({ items: [second] });
    } finally {
      await restarted.close();
    }
  } finally {
    await controller.dispose();
    await fixture.runtime.dispose();
  }
});
