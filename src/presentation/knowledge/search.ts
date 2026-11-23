import {
  knowledgeChanges,
  knowledgeDetailRoute,
  knowledgeSnapshot,
  projectKnowledge,
} from "../../application/knowledge";
import type { ProjectId } from "../../application/projects";
import { useStream } from "../shell";

export function knowledgeSearchSource() {
  const source = useStream(knowledgeSnapshot, knowledgeChanges);
  return (projectId: ProjectId) =>
    projectKnowledge(projectId, source.value.records).map(({ id, title, displayId, path }) => ({
      projectId,
      kind: "knowledge",
      recordId: id,
      title,
      displayId,
      notePath: path,
      route: knowledgeDetailRoute(projectId, id),
    }));
}
