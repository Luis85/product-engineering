import { request } from "node:http";
import { projectMcpToolName } from "../../application/integrations";
import type { LocalMcpConnection, ProjectMcpProbe } from "../../application/integrations";

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function resultFrom(body: string, projectId: string): ProjectMcpProbe {
  try {
    const payload =
      body
        .split(/\r?\n/u)
        .find((line) => line.startsWith("data: "))
        ?.slice(6) ?? body;
    const response: unknown = JSON.parse(payload);
    if (!object(response) || response.id !== 1 || !object(response.result)) return "unavailable";
    if (response.result.isError === true) return "denied";
    const { structuredContent } = response.result;
    return object(structuredContent) && structuredContent.id === projectId
      ? "allowed"
      : "unavailable";
  } catch {
    return "unavailable";
  }
}

export function probeProjectMcpRead(
  connection: LocalMcpConnection | undefined,
  projectId: string,
  signal: AbortSignal,
): Promise<ProjectMcpProbe> {
  if (!connection) return Promise.resolve("stopped");
  return new Promise((resolve) => {
    const body = JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: { name: projectMcpToolName, arguments: { projectId } },
    });
    const probe = request(
      connection.endpoint,
      {
        method: "POST",
        signal: AbortSignal.any([signal, AbortSignal.timeout(4000)]),
        headers: {
          Authorization: `Bearer ${connection.token}`,
          Accept: "application/json, text/event-stream",
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
        },
      },
      (response) => {
        let text = "";
        response.setEncoding("utf8");
        response.on("data", (chunk: string) => {
          text += chunk;
          if (text.length > 8192) response.destroy();
        });
        response.once("error", () => resolve("unavailable"));
        response.once("close", () => resolve("unavailable"));
        response.once("end", () => resolve(resultFrom(text, projectId)));
      },
    );
    probe.once("error", () => resolve("unavailable"));
    probe.end(body);
  });
}
