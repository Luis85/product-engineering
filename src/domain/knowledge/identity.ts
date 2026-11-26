import { Schema } from "effect";
import { recordIdIssue } from "../notes";

export const knowledgeId = Schema.TemplateLiteral(["knowledge-", Schema.String]).check(
  Schema.makeFilter((id) => recordIdIssue("knowledge", id) === undefined),
);
export const isKnowledgeId = Schema.is(knowledgeId);
export type KnowledgeId = typeof knowledgeId.Type;
