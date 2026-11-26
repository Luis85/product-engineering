import { Effect } from "effect";
import { isKnowledgeId } from "../../domain/knowledge";
import type { GitArtifactSource } from "../git";
import type { ProjectRecordRoute } from "../projects";
import { resolveKnowledgeNote } from "./selection";

export function knowledgeGitSource({
  projectId,
  reference,
}: ProjectRecordRoute): GitArtifactSource {
  const recordId = reference.recordId;
  return {
    projectId,
    resolvePath:
      reference.kind === "knowledge" && isKnowledgeId(recordId)
        ? Effect.map(resolveKnowledgeNote(projectId, recordId), (note) => note?.path)
        : Effect.succeed(undefined),
  };
}
