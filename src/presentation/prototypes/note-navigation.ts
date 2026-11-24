import { knowledgeDetailRoute } from "../../application/knowledge";
import type { ProjectId } from "../../application/projects";
import { prototypeNoteOrigin } from "../../application/prototypes";
import type { KnowledgeId } from "../../domain/knowledge";
import type { PrototypeId } from "../../domain/prototypes";
import { useRememberWorkspaceOrigin } from "../projects";
import { useNavigate } from "../shell";

export function usePrototypeNoteNavigation() {
  const navigate = useNavigate();
  const remember = useRememberWorkspaceOrigin();
  return async (
    projectId: ProjectId,
    prototypeId: PrototypeId,
    note: KnowledgeId,
    event: MouseEvent,
  ) => {
    remember(event.currentTarget as HTMLElement);
    if (!(await navigate(knowledgeDetailRoute(projectId, note, prototypeNoteOrigin(prototypeId)))))
      remember(undefined);
  };
}
