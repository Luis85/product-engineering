import { Schema } from "effect";
import {
  deliveryStages,
  featureRequestIdSchema,
  isFeatureRequestId,
} from "../../domain/feature-requests";
import type { DeliveryStage, FeatureRequestId } from "../../domain/feature-requests";
import { backlogBoardContextSchema } from "../backlog";
import { projectIdSchema } from "../projects";
import type { ProjectId, ProjectOrigin } from "../projects";
import { requestRevisionNumber } from "./delivery-package";

export const PROJECT_FEATURE_REQUESTS = "project-feature-requests";
export const PROJECT_REVIEWS = "project-reviews";
const requestOriginSchema = Schema.Union([
  Schema.Struct({ kind: Schema.Literal("board"), context: backlogBoardContextSchema }),
  Schema.Struct({ kind: Schema.Literals(["list", "pbi"]) }),
]);
export type FeatureRequestOrigin = typeof requestOriginSchema.Type;
export const projectFeatureRequestsSchema = Schema.Struct({
  name: Schema.Literal(PROJECT_FEATURE_REQUESTS),
  projectId: projectIdSchema,
  requestId: Schema.optionalKey(featureRequestIdSchema),
  stage: Schema.optionalKey(Schema.Literals(deliveryStages)),
  tab: Schema.optionalKey(Schema.Literal("gates")),
  origin: Schema.optionalKey(requestOriginSchema),
});
export type FeatureRequestsRoute = typeof projectFeatureRequestsSchema.Type;

const reviewSelection = Schema.Struct({
  requestId: featureRequestIdSchema,
  revision: requestRevisionNumber,
});
export const projectReviewsSchema = Schema.Struct({
  name: Schema.Literal(PROJECT_REVIEWS),
  projectId: projectIdSchema,
  selection: Schema.optionalKey(reviewSelection),
});
export type ReviewsRoute = typeof projectReviewsSchema.Type;

export function reviewsRoute(
  projectId: ProjectId,
  selection?: ReviewsRoute["selection"],
): ReviewsRoute {
  return { name: PROJECT_REVIEWS, projectId, ...(selection && { selection }) };
}

export function featureRequestsRoute(
  projectId: ProjectId,
  selection: {
    readonly stage?: DeliveryStage;
    readonly requestId?: FeatureRequestId;
    readonly tab?: "gates";
    readonly origin?: FeatureRequestOrigin;
  } = {},
): FeatureRequestsRoute {
  return { name: PROJECT_FEATURE_REQUESTS, projectId, ...selection };
}

export const featureRequestNoteOrigin = (recordId: FeatureRequestId): ProjectOrigin => ({
  section: "feature-requests",
  reference: { kind: "request", recordId },
});

export function featureRequestOriginRoute(projectId: ProjectId, origin: ProjectOrigin | undefined) {
  const requestId = origin?.reference?.recordId;
  if (
    origin?.section === "feature-requests" &&
    origin.reference?.kind === "request" &&
    isFeatureRequestId(requestId)
  )
    return featureRequestsRoute(projectId, { requestId });
}
