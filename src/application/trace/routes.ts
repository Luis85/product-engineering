import { Schema } from "effect";
import { projectIdSchema } from "../projects";
import type { ProjectId } from "../projects";

export const PROJECT_TRACE = "project-trace";
export const projectTraceSchema = Schema.Struct({
  name: Schema.Literal(PROJECT_TRACE),
  projectId: projectIdSchema,
  pbi: Schema.optionalKey(Schema.String.check(Schema.isMinLength(1))),
});

export type TraceRoute = typeof projectTraceSchema.Type;

export function traceRoute(projectId: ProjectId, pbi?: string): TraceRoute {
  return { name: PROJECT_TRACE, projectId, ...(pbi && { pbi }) };
}
