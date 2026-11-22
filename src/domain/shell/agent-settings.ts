import { Schema } from "effect";

export const McpPort = Schema.Int.check(Schema.isBetween({ minimum: 0, maximum: 65535 }));

export const CliExecutablePath = Schema.Trim.check(
  Schema.isPattern(/^(?:$|(?:\/|[A-Za-z]:[\\/]|\\\\)[^\r\n\0]+)$/),
);

const validPort = Schema.is(McpPort);

export function parseMcpPort(draft: string): number | undefined {
  const text = draft.trim();
  if (text === "") return 0;
  if (!/^\d+$/.test(text)) return;

  const port = Number(text);
  return validPort(port) ? port : undefined;
}
