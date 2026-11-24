import { Schema } from "effect";
import { deliveryStages, featureRequestIdSchema } from "../../domain/feature-requests";
import type { DeliveryStage, FeatureRequestId } from "../../domain/feature-requests";
import { backlogBoardContextSchema } from "../backlog";
import { projectIdSchema } from "../projects";
import type { ProjectId } from "../projects";

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
