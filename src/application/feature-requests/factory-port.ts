import { Context, Effect, Layer, Schema } from "effect";
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
