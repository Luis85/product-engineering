import { Context, Effect, Layer, Option, Schema } from "effect";
import { featureRequestIdSchema } from "../../domain/feature-requests";
import { projectIdSchema } from "../../domain/projects";
import { requestRevisionNumber, requestSha } from "./delivery-package";
import type { RequestPackage } from "./delivery-package";
import { FeatureRequestError } from "./errors";

const str = Schema.String;
const fixture = Schema.Literal("local-fixture");
const checksum = str.check(Schema.isPattern(/^[\da-f]{64}$/));
const keys = {
  projectId: projectIdSchema,
  requestId: featureRequestIdSchema,
  revision: requestRevisionNumber,
  checksum,
};
const acknowledgement = { ...keys, runId: str, attempt: requestRevisionNumber, provider: fixture };
export const factoryAcknowledgement = Schema.Struct(acknowledgement);
const factoryEvidence = Schema.Struct({
  criterionId: str,
  scenarioId: str,
  commit: requestSha,
  outcome: Schema.Literals(["passed", "failed"]),
  checkId: str,
});
const result = Schema.Struct({
  pullRequest: str,
  commit: requestSha,
  technicalReview: Schema.Struct({ verdict: Schema.Literal("approved"), commit: requestSha }),
  evidence: Schema.Array(factoryEvidence),
});
const key = { ...acknowledgement, id: str };
const looseReceipt = Schema.Struct({
  ...key,
  kind: Schema.Literal("verified"),
  result: Schema.Struct({
    pullRequest: Schema.optionalKey(str),
    commit: Schema.optionalKey(Schema.Unknown),
    technicalReview: Schema.optionalKey(Schema.Unknown),
    evidence: Schema.optionalKey(Schema.Unknown),
  }),
});
export const factoryEventSchema = Schema.Union([
  Schema.Struct({ ...key, kind: Schema.Literal("picked-up"), worker: str }),
  Schema.Struct({ ...key, kind: Schema.Literal("question"), scope: str, question: str }),
  Schema.Struct({
    ...key,
    kind: Schema.Literal("failed"),
    reason: Schema.Literal("lease-expired"),
  }),
  Schema.Struct({ ...key, kind: Schema.Literal("verified"), result }),
]);
export const factoryJournalEvent = Schema.Union([
  factoryEventSchema,
  Schema.Struct({ ...key, kind: Schema.Literals(["dispatched", "retried"]) }),
  Schema.Struct({
    ...key,
    kind: Schema.Literals(["reply", "scope-change"]),
    reply: str,
    questionId: str,
  }),
]);
export type FactoryAcknowledgement = typeof factoryAcknowledgement.Type;
export type FactoryCallback = typeof factoryEventSchema.Type;
export type FactoryJournalEvent = typeof factoryJournalEvent.Type;
export type FactoryFixtureAction = "pickup" | "question" | "fail" | "verify";
type DeliveryCommand = Omit<FactoryAcknowledgement, "provider" | "runId">;

export function matchesRun(expected: DeliveryCommand, actual: FactoryAcknowledgement) {
  return (
    expected.projectId === actual.projectId &&
    expected.requestId === actual.requestId &&
    expected.revision === actual.revision &&
    expected.attempt === actual.attempt &&
    expected.checksum === actual.checksum
  );
}

export function requestCiPassed(
  payload: RequestPackage,
  { commit, evidence }: Pick<typeof result.Type, "commit" | "evidence">,
) {
  const criteria = payload.useCase?.criteria ?? [];
  return (
    criteria.length > 0 &&
    evidence.length === criteria.length &&
    new Set(evidence.map(({ checkId }) => checkId)).size === evidence.length &&
    evidence.every(
      (check) => check.checkId && check.commit === commit && check.outcome === "passed",
    ) &&
    criteria.every(
      ({ id, scenario_id }) =>
        evidence.filter((check) => check.criterionId === id && check.scenarioId === scenario_id)
          .length === 1,
    )
  );
}

const decodeLooseReceipt = Schema.decodeUnknownOption(looseReceipt);
const decodeEvidence = Schema.decodeUnknownOption(Schema.Array(factoryEvidence));
const isCommit = Schema.is(requestSha);
const isTechnical = Schema.is(result.fields.technicalReview);

export function readIncompleteReceipt(events: readonly unknown[], run: FactoryAcknowledgement) {
  const exact = events
    .toReversed()
    .map((event) => Option.getOrUndefined(decodeLooseReceipt(event)))
    .find((event) => event && event.runId === run.runId && matchesRun(run, event));
  const partial = exact?.result;
  if (!partial || !isCommit(partial.commit)) return { issue: "commit" as const };
  const { commit, pullRequest, technicalReview } = partial;
  return {
    issue:
      isTechnical(technicalReview) && technicalReview.commit === commit
        ? ("receipt" as const)
        : ("technical" as const),
    commit,
    pullRequest,
    evidence: Option.getOrUndefined(decodeEvidence(partial.evidence)),
  };
}

export class FeatureRequestDelivery extends Context.Service<
  FeatureRequestDelivery,
  {
    readonly dispatch: (
      request: DeliveryCommand,
      payload: RequestPackage,
    ) => Effect.Effect<FactoryAcknowledgement, FeatureRequestError>;
    readonly retry: (
      previous: FactoryAcknowledgement,
    ) => Effect.Effect<FactoryAcknowledgement, FeatureRequestError>;
    readonly fixtureEvent: (
      request: FactoryAcknowledgement,
      payload: RequestPackage,
      action: FactoryFixtureAction,
      eventNumber: number,
    ) => Effect.Effect<FactoryCallback, FeatureRequestError>;
  }
>()("product-engineering/application/FeatureRequestDelivery") {}

const unavailable = () => Effect.fail(new FeatureRequestError({ reason: "delivery" }));
export const unavailableRequestDelivery = Layer.succeed(FeatureRequestDelivery, {
  dispatch: unavailable,
  retry: unavailable,
  fixtureEvent: unavailable,
});
