import { knowledgeDetailRoute } from "../../application/knowledge";
import type { Note } from "../../application/notes";
import type { ProjectId, ProjectOrigin, ProjectRecordRoute } from "../../application/projects";
import type { Route } from "../../application/routes";
import { isKnowledgeId } from "../../domain/knowledge";
import { useRememberWorkspaceOrigin } from "../projects";
import { useRouting } from "../shell";

const handoffs = new WeakMap<
  object,
  { readonly route: ProjectRecordRoute; readonly path: string }
>();

export function useKnowledgeDraftNavigation() {
  const { navigation, definition } = useRouting();
  const rememberOrigin = useRememberWorkspaceOrigin();

  async function openDraft(
    note: Note,
    projectId: ProjectId,
    origin: ProjectOrigin,
    trigger?: HTMLElement,
  ) {
    const id = note.frontmatter.id;
    if (!isKnowledgeId(id) || note.frontmatter.project_id !== projectId) return;
    const route = knowledgeDetailRoute(projectId, id, origin);
    const entry = { route, path: note.path };
    handoffs.set(navigation, entry);
    rememberOrigin(trigger);
    if (!(await navigation.navigate(route)) && handoffs.get(navigation) === entry) {
      handoffs.delete(navigation);
      rememberOrigin(undefined);
    }
  }

  function takeDraft(route: Route) {
    const entry = handoffs.get(navigation);
    if (!entry || !definition.equals(entry.route, route)) return;
    handoffs.delete(navigation);
    return entry.path;
  }
  return { openDraft, takeDraft };
}
