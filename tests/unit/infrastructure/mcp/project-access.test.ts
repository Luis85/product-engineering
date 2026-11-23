import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { expect, it } from "vitest";
import type { ProjectMcpCandidate } from "../../../../src/application/integrations";
import type { ProjectId } from "../../../../src/application/projects";
import { createMcpController, probeProjectMcpRead } from "../../../../src/infrastructure/mcp";

const first = "project-33333333-3333-4333-8333-000000000001";
const second = "project-33333333-3333-4333-8333-000000000002";

it("enforces live project opt-in, target scope and repository availability on direct tool calls", async () => {
  let optIn = true;
  let repo = "produktteam/kundenportal";
  let wrongScope = false;
  const settings = {
    version: "1.0.0",
    readItem: () => Promise.resolve(undefined),
    readProject: (
      id: ProjectId,
    ): Promise<ProjectMcpCandidate & { readonly privateField?: string }> =>
      Promise.resolve(
        id === first
          ? {
              id: wrongScope ? second : first,
              name: "Kundenportal",
              repository: repo,
              branch: "main",
              dataClass: "internal" as const,
              mcpRead: optIn,
              privateField: "leave outside the scope",
            }
          : {
              id: second,
              name: "Admin Console",
              repository: "produktteam/admin-console",
              branch: "main",
              dataClass: "internal" as const,
              mcpRead: false,
            },
      ),
  };
  const controller = createMcpController(settings);
  const client = new Client({ name: "project-access", version: "1" });
  try {
    const connection = await controller.start(0, []);
    await client.connect(
      new StreamableHTTPClientTransport(new URL(connection.endpoint), {
        requestInit: { headers: { Authorization: `Bearer ${connection.token}` } },
      }),
    );
    const read = (projectId: string) =>
      client.callTool({ name: "get_project", arguments: { projectId } });
    expect((await read(first)).structuredContent).toEqual({
      id: first,
      name: "Kundenportal",
      repository: repo,
      branch: "main",
      dataClass: "internal",
    });
    await expect(
      probeProjectMcpRead(connection, first, new AbortController().signal),
    ).resolves.toBe("allowed");
    expect((await read(second)).isError).toBe(true);
    optIn = false;
    expect((await read(first)).isError).toBe(true);
    await expect(
      probeProjectMcpRead(connection, first, new AbortController().signal),
    ).resolves.toBe("denied");
    expect(controller.status().state).toBe("running");
    optIn = true;
    repo = "";
    expect((await read(first)).isError).toBe(true);
    repo = "produktteam/kundenportal";
    wrongScope = true;
    expect((await read(first)).isError).toBe(true);
  } finally {
    await client.close();
    await controller.dispose();
  }
});
