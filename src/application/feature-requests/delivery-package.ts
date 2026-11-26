import { Effect, Option, Schema } from "effect";
import { nfrCategories } from "../../domain/backlog";
import { featureRequestIdSchema } from "../../domain/feature-requests";
import { cardinalities, knowledgeId } from "../../domain/knowledge";
import {
  projectCriterionIdSchema,
  projectCriterionTypes,
  projectDataClassSchema,
  projectIdSchema,
} from "../../domain/projects";
import { FeatureRequestError } from "./errors";

const str = Schema.String;
const optional = Schema.optionalKey;
const list = Schema.Array;
export const requestSha = str.check(Schema.isPattern(/^[\da-f]{40}(?:[\da-f]{24})?$/));
export const requestRevisionNumber = Schema.Int.check(Schema.isGreaterThan(0));
export const requestGateSchema = Schema.Struct({
  id: str,
  title: optional(str),
  status: Schema.Literals(["passed", "open", "unavailable"]),
});
const requestCriterionSchema = Schema.Struct({
  id: projectCriterionIdSchema,
  title: str,
  type: Schema.Literals(projectCriterionTypes),
  enabled: Schema.Boolean,
});
const origin = Schema.Struct({
  projectId: projectIdSchema,
  kind: Schema.Literals(["item", "map", "prd", "nfr"]),
  id: str,
  title: str,
  displayId: optional(str),
});
const nfr = Schema.Struct({
  id: str,
  title: str,
  requirement: str,
  acceptance: str,
  categories: list(Schema.Literals(nfrCategories.map(([id]) => id))),
  owner_id: optional(str),
  sources: list(origin),
});
const endpoint = { id: knowledgeId, displayId: str, title: str };
const domain = Schema.Struct({
  entities: list(
    Schema.Struct({
      ...endpoint,
      definition: str,
      origins: list(origin),
      attributes: list(Schema.Struct({ name: str, description: str })),
    }),
  ),
  neighbors: list(Schema.Struct(endpoint)),
  edges: list(
    Schema.Struct({
      id: str,
      source: knowledgeId,
      target: knowledgeId,
      verb: str,
      rule: optional(str),
      sourceCardinality: Schema.Literals(cardinalities),
      targetCardinality: Schema.Literals(cardinalities),
      sourceEntity: Schema.Struct(endpoint),
      targetEntity: Schema.Struct(endpoint),
    }),
  ),
});
const source = {
  id: str,
  displayId: str,
  title: str,
  markdown: str,
  commit: optional(requestSha),
  revision: optional(requestRevisionNumber),
};
const destination = Schema.Struct({
  repository: str,
  branch: str,
  dataClass: projectDataClassSchema,
});
const link = Schema.Struct({
  source: str,
  target: str,
  anchor: optional(str),
  alias: optional(str),
  artifact: optional(Schema.Struct({ id: str, commit: requestSha })),
});
const packageContent = Schema.Struct({
  schemaVersion: Schema.Literal(1),
  request: Schema.Struct({
    projectId: projectIdSchema,
    id: featureRequestIdSchema,
    displayId: str,
    revision: requestRevisionNumber,
    title: str,
  }),
  scope: str,
  destination: optional(destination),
  useCase: optional(
    Schema.Struct({
      ...source,
      owner: optional(str),
      criteria: list(
        Schema.Struct({
          id: str,
          text: str,
          scenario_id: str,
          scenario_name: str,
          given: str,
          when: str,
          then_step: str,
        }),
      ),
    }),
  ),
  requirement: optional(
    Schema.Struct({ id: str, artifactId: str, commit: optional(requestSha), anchor: str }),
  ),
  attachments: list(Schema.Struct({ ...source, kind: str })),
  gherkin: str,
  links: optional(list(link)),
  workIds: optional(list(str)),
  nfrs: optional(list(nfr)),
  domain: optional(domain),
  definitions: optional(
    Schema.Struct({
      projectId: projectIdSchema,
      version: requestRevisionNumber,
      ready: list(requestCriterionSchema),
      done: list(requestCriterionSchema),
    }),
  ),
  readyEvidence: optional(list(requestGateSchema)),
});
const checksum = Schema.Struct({
  algorithm: Schema.Literal("SHA-256"),
  serialization: Schema.Literal("sorted-json-utf8-v1"),
  value: str.check(Schema.isPattern(/^[\da-f]{64}$/)),
});
const storedPackage = Schema.Struct({ package: packageContent, checksum: optional(checksum) });
export type RequestPackage = typeof packageContent.Type;
export type StoredRequestPackage = typeof storedPackage.Type;
const parseRequestPackage = Schema.decodeUnknownOption(Schema.fromJsonString(storedPackage));

export function decodeRequestPackage(raw: string) {
  return Option.filter(
    parseRequestPackage(raw),
    (stored) => stored.checksum === undefined || raw === canonicalRequestJson(stored),
  );
}

// Version 1 uses compact JSON, sorted own enumerable object keys in UTF-16 order,
// JSON array order, UTF-8 without BOM or final newline. Hash only the `package` value.
export function canonicalRequestJson(value: unknown) {
  return JSON.stringify(value, (_key, item: unknown): unknown => {
    if (item === null || typeof item !== "object" || Array.isArray(item)) return item;
    const keys = Object.keys(item).toSorted();
    return Object.fromEntries(keys.map((key) => [key, Reflect.get(item, key) as unknown]));
  });
}

function requestPackageChecksum(payload: RequestPackage) {
  return Effect.promise(async () => {
    const bytes = new TextEncoder().encode(canonicalRequestJson(payload));
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    const value = [...new Uint8Array(digest)]
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
    return { algorithm: "SHA-256", serialization: "sorted-json-utf8-v1", value } as const;
  });
}

export function encodeRequestPackage(payload: RequestPackage) {
  return Effect.map(requestPackageChecksum(payload), (value) =>
    canonicalRequestJson({ package: payload, checksum: value }),
  );
}

export function verifyRequestPackage(stored: StoredRequestPackage) {
  if (!stored.checksum) return Effect.fail(new FeatureRequestError({ reason: "evidence" }));
  return Effect.flatMap(requestPackageChecksum(stored.package), (actual) =>
    actual.value === stored.checksum?.value
      ? Effect.succeed(actual.value)
      : Effect.fail(new FeatureRequestError({ reason: "evidence" })),
  );
}
