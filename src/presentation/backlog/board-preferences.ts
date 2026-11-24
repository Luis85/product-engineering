import { computed, onMounted, ref } from "vue";
import type { Ref } from "vue";
import type { ProjectId } from "../../application/projects";
import type { BoardStage } from "../../domain/backlog";

export const boardEdges = ["Backlog", "Done"] as const;
type Edge = (typeof boardEdges)[number];

function preferenceKey(project: ProjectId) {
  return "product-engineering:board:" + project;
}

export function useBoardFolds(project: ProjectId, panel: Ref<HTMLElement | undefined>) {
  const folded = ref<Edge[]>([]);
  let store: Storage | undefined;
  onMounted(() => {
    try {
      store = panel.value?.ownerDocument.defaultView?.localStorage;
      const saved: unknown = JSON.parse(store?.getItem(preferenceKey(project)) ?? "null");
      if (Array.isArray(saved)) folded.value = boardEdges.filter((stage) => saved.includes(stage));
    } catch {
      // Board controls remain usable if the host cannot read local preferences.
    }
  });
  const states = computed(() => new Set<BoardStage>(folded.value));
  function toggle(stage: BoardStage) {
    const edge = boardEdges.find((value) => stage === value);
    if (!edge) return;
    folded.value = states.value.has(edge)
      ? folded.value.filter((value) => value !== edge)
      : [...folded.value, edge];
    try {
      store?.setItem(preferenceKey(project), JSON.stringify(folded.value));
    } catch {
      // The mounted Board still remembers the current fold.
    }
  }
  return { folded: states, toggle };
}
