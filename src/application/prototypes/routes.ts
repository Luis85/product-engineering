import { Schema } from "effect";
import { prototypeIdSchema } from "../../domain/prototypes";
import type { PrototypeId } from "../../domain/prototypes";
import { projectIdSchema } from "../projects";
import type { ProjectId } from "../projects";

export const PROJECT_PROTOTYPES = "project-prototypes";
export const projectPrototypesSchema = Schema.Struct({
  name: Schema.Literal(PROJECT_PROTOTYPES),
  projectId: projectIdSchema,
  prototypeId: Schema.optionalKey(prototypeIdSchema),
});

export function prototypesRoute(
  projectId: ProjectId,
  prototypeId?: PrototypeId,
): typeof projectPrototypesSchema.Type {
  return { name: PROJECT_PROTOTYPES, projectId, ...(prototypeId && { prototypeId }) };
}
