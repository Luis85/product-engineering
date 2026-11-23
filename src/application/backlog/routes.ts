import { Schema } from "effect";
import { backlogIdSchema } from "../../domain/backlog";
import { projectIdSchema } from "../projects";
import type { ProjectId } from "../projects";

export const PROJECT_BACKLOG = "project-backlog";
export const PROJECT_USE_CASE = "project-usecase";
export const backlogTabs = ["board", "list", "nfrs", "deliverables"] as const;
export type BacklogTab = (typeof backlogTabs)[number];

export const projectBacklogSchema = Schema.Struct({
  name: Schema.Literal(PROJECT_BACKLOG),
  projectId: projectIdSchema,
  tab: Schema.optionalKey(Schema.Literal("list")),
  item: Schema.optionalKey(backlogIdSchema),
});

export function backlogRoute(
  projectId: ProjectId,
  item?: string,
): typeof projectBacklogSchema.Type {
  return { name: PROJECT_BACKLOG, projectId, tab: "list", ...(item && { item }) };
}

export const projectUseCaseSchema = Schema.Struct({
  name: Schema.Literal(PROJECT_USE_CASE),
  projectId: projectIdSchema,
  pbiId: backlogIdSchema.check(Schema.isPattern(/^UC-/)),
});

export function pbiDetailRoute(
  projectId: ProjectId,
  pbiId: string,
): typeof projectUseCaseSchema.Type {
  return { name: PROJECT_USE_CASE, projectId, pbiId };
}
