import { Schema, SchemaGetter } from "effect";

export const AiMode = Schema.Literals(["demo", "codex", "claude-code"]);
export type AiMode = typeof AiMode.Type;

export const McpPort = Schema.Int.check(Schema.isBetween({ minimum: 0, maximum: 65535 }));

export const CliExecutablePath = Schema.Trim.check(
  Schema.isPattern(/^(?:$|(?:\/|[A-Za-z]:[\\/]|\\\\)[^\r\n\0]+)$/),
);

const OptionalItemIds = Schema.UndefinedOr(Schema.Array(Schema.NonEmptyString));
export const McpSharedItemIds = OptionalItemIds.pipe(
  Schema.decodeTo(OptionalItemIds, {
    decode: SchemaGetter.transform((ids) => (ids?.length ? [...new Set(ids)] : undefined)),
    encode: SchemaGetter.passthrough(),
  }),
);

const validPort = Schema.is(McpPort);

export function parseMcpPort(draft: string): number | undefined {
  const text = draft.trim();
  if (text === "") return 0;
  if (!/^\d+$/.test(text)) return;

  const port = Number(text);
  return validPort(port) ? port : undefined;
}
