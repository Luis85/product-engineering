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

export const PROJECT_FEATURE_REQUESTS = "project-feature-requests";
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
