import { Schema } from "effect";
import { lineOfText } from "../../domain/notes";
import { projectIdSchema } from "../projects";
import type { ProjectId } from "../projects";

export const PROJECT_DOMAIN_MODEL = "project-domainmodel";
export const projectDomainModelSchema = Schema.Struct({
  name: Schema.Literal(PROJECT_DOMAIN_MODEL),
  projectId: projectIdSchema,
  selection: Schema.optionalKey(lineOfText(80).check(Schema.isMinLength(1))),
});

export function domainModelRoute(
  projectId: ProjectId,
  selection?: string,
): typeof projectDomainModelSchema.Type {
  return { name: PROJECT_DOMAIN_MODEL, projectId, ...(selection && { selection }) };
}
