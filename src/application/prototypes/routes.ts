import { Schema } from "effect";
import { isPrototypeId, prototypeIdSchema } from "../../domain/prototypes";
import type { PrototypeId } from "../../domain/prototypes";
import { projectIdSchema } from "../projects";
import type { ProjectId, ProjectOrigin } from "../projects";

export const PROJECT_PROTOTYPES = "project-prototypes";
const PROTOTYPE_NOTE_ORIGIN = "prototypes";
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

export function prototypeNoteOrigin(prototypeId: PrototypeId) {
  return {
    section: PROTOTYPE_NOTE_ORIGIN,
    reference: { kind: "prototype", recordId: prototypeId },
  } as const satisfies ProjectOrigin;
}

export function prototypeOriginRoute(projectId: ProjectId, origin: ProjectOrigin | undefined) {
  if (origin?.section !== PROTOTYPE_NOTE_ORIGIN) return;
  const reference = origin.reference;
  const id =
    reference?.kind === "prototype" && isPrototypeId(reference.recordId)
      ? reference.recordId
      : undefined;
  return prototypesRoute(projectId, id);
}
