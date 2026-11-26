import { Schema } from "effect";
import { lineOfText } from "../notes";

const knowledgeSourceLink = Schema.Struct({
  kind: Schema.Literals(["knowledge", "pbi", "map", "nfr"]),
  id: lineOfText(160).check(Schema.isMinLength(1)),
});

export const knowledgeSourceLinks = Schema.Array(knowledgeSourceLink);
export type KnowledgeSourceLink = typeof knowledgeSourceLink.Type;
