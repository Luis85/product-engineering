import { reactive } from "vue";
import type { KnowledgeKind } from "../../application/knowledge";
import type { ProjectId } from "../../application/projects";
import type { ActorType } from "../../domain/knowledge";
import { useRouting } from "../shell";

export type LibraryFilter = "" | KnowledgeKind | "concepts" | "other";
type Preferences = {
  query: string;
  filter: LibraryFilter;
  actor: "" | ActorType;
  concept: "" | KnowledgeKind;
};

const leafPreferences = new WeakMap<object, Map<ProjectId, Preferences>>();

export function libraryDefaults(): Preferences {
  return { query: "", filter: "", actor: "", concept: "" };
}

export function useLibraryPreferences() {
  const { navigation } = useRouting();
  const preferences = leafPreferences.get(navigation) ?? new Map<ProjectId, Preferences>();
  leafPreferences.set(navigation, preferences);
  return (projectId: ProjectId) => {
    const saved = preferences.get(projectId) ?? reactive(libraryDefaults());
    preferences.set(projectId, saved);
    return saved;
  };
}
