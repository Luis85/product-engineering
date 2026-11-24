import { computed, watch } from "vue";
import { PROJECT_OVERVIEW, projectOverviewRoute } from "../../application/projects";
import type { ProjectId } from "../../application/projects";
import { useRoute, useRouting } from "../shell";

const leafSelections = new WeakMap<object, Map<ProjectId, string>>();

export function useOverviewPreference(projectId: ProjectId) {
  const route = useRoute();
  const { navigation } = useRouting();
  const selections = leafSelections.get(navigation) ?? new Map<ProjectId, string>();
  leafSelections.set(navigation, selections);
  const active = computed(() => {
    const scope = route.value;
    if (scope.name === PROJECT_OVERVIEW && scope.projectId === projectId) return scope;
  });
  const preference = computed(() => active.value?.context ?? selections.get(projectId));

  async function select(key: string) {
    if (active.value && (await navigation.replace(projectOverviewRoute(projectId, key))))
      selections.set(projectId, key);
  }

  watch(
    active,
    (scope) => {
      if (scope?.context) selections.set(projectId, scope.context);
    },
    { immediate: true },
  );
  return { preference, select };
}
