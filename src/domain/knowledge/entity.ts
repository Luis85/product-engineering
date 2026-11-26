import { Result, Schema } from "effect";
import { checkbox, lineOfText, list, recordList } from "../notes";
import { knowledgeId } from "./identity";

export const cardinalities = ["1", "0..1", "1..*", "0..*"] as const;
const cardinality = Schema.Literals(cardinalities);
const relationId = Schema.String.check(
  Schema.isPattern(/^REL-(?:[0-9]+|[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12})$/),
);
const nonemptyLine = lineOfText(160).check(Schema.isMinLength(1));
const descriptionText = Schema.String.check(Schema.isMaxLength(4000));

const attribute = Schema.Struct({ name: nonemptyLine, description: descriptionText });
const edge = Schema.Struct({
  id: relationId,
  target: knowledgeId,
  verb: nonemptyLine,
  sourceCardinality: cardinality,
  targetCardinality: cardinality,
  rule: Schema.optionalKey(descriptionText),
  movedFrom: Schema.optionalKey(knowledgeId),
});
const scope = Schema.Struct({ kind: Schema.Literals(["prd", "item", "map"]), id: nonemptyLine });

export type Cardinality = typeof cardinality.Type;
export type EntityAttribute = typeof attribute.Type;
export type EntityEdge = typeof edge.Type;
export type EntityScopeTarget = typeof scope.Type;

export const entityFields = {
  domain_archived: checkbox(),
  domain_attributes: recordList({ schema: Schema.Array(attribute), issue: "attribute.invalid" }),
  domain_edges: recordList({ schema: Schema.Array(edge), issue: "edge.invalid" }),
  domain_retired_edges: list({ schema: Schema.Array(relationId), issue: "edge.invalid" }),
  domain_scope: recordList({ schema: Schema.Array(scope), issue: "scope.invalid" }),
};

export function checkedEntityAttributes(attributes: readonly EntityAttribute[]) {
  const cleaned = attributes
    .map(({ name, description }) => ({
      name: name.trim(),
      description: description.trim(),
    }))
    .filter(({ name, description }) => name || description);
  const distinct = new Set(cleaned.map(({ name }) => name.normalize("NFC").toLowerCase()));
  return distinct.size === cleaned.length
    ? entityFields.domain_attributes.check(cleaned)
    : Result.fail("attribute.invalid");
}
