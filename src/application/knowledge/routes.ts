import { Schema } from "effect";
import { projectIdSchema } from "../projects";
import { projectRecordRoute } from "../projects";
import type { ProjectId, ProjectOrigin } from "../projects";
import type { KnowledgeId } from "../../domain/knowledge";

export const PROJECT_KNOWLEDGE = "project-knowledge";
export const projectKnowledgeSchema = Schema.Struct({
  name: Schema.Literal(PROJECT_KNOWLEDGE),
  projectId: projectIdSchema,
});

export function projectKnowledgeRoute(projectId: ProjectId): typeof projectKnowledgeSchema.Type {
  return { name: PROJECT_KNOWLEDGE, projectId };
}

export function knowledgeDetailRoute(
  projectId: ProjectId,
  recordId: KnowledgeId,
  origin: ProjectOrigin = { section: "knowledge" },
) {
  return projectRecordRoute({ projectId, kind: "knowledge", recordId }, origin);
}
