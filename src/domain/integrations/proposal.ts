import { Option, Schema } from "effect";
import { lineOfText } from "../notes";

export const COPILOT_PROPOSAL_LIMIT = 48_000;
const proposal = Schema.Struct({
  title: lineOfText(160).check(Schema.makeFilter((value) => Boolean(value.trim()))),
  body: Schema.String.check(
    Schema.isMaxLength(COPILOT_PROPOSAL_LIMIT),
    Schema.makeFilter((value) => Boolean(value.trim()) && !value.includes("\0")),
  ),
});

export type CopilotProposalContent = typeof proposal.Type;
export const isCopilotProposalContent = Schema.is(proposal);
const decode = Schema.decodeUnknownOption(Schema.fromJsonString(proposal));

export function safeProposalMarkdown(markdown: string) {
  return markdown
    .replace(/!\[\[([^\]\r\n]*)\]\]/gu, "[$1]")
    .replace(/!\[([^\]\r\n]*)\]\([^\r\n]*\)/gu, "$1")
    .replace(/!\[([^\]\r\n]*)\]/gu, "[$1]")
    .replaceAll("<", "&lt;");
}

export function parseCopilotProposal(text: string) {
  const fenced = /^\s*```(?:json)?\s*\n([\s\S]*?)\n```\s*$/iu.exec(text);
  const parsed = Option.getOrUndefined(decode(fenced?.[1] ?? text));
  return parsed
    ? { title: parsed.title.trim(), body: safeProposalMarkdown(parsed.body) }
    : undefined;
}
