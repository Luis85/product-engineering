import { computed, onMounted, ref, watch } from "vue";
import type { Ref } from "vue";
import type { BacklogBoardContext, BacklogBoardReturn } from "../../application/backlog";
import type { ProjectId } from "../../application/projects";
import type { BoardStage } from "../../domain/backlog";
import { useWorkspaceOriginKey } from "../projects";
import type { BacklogFilters } from "./preferences";

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

export function useBoardRequestContext(
  resumed: () => BacklogBoardReturn | undefined,
  preferences: BacklogFilters & { boardScroll: number },
  scroll: Ref<HTMLElement | undefined>,
) {
  const origin = useWorkspaceOriginKey();
  watch(
    resumed,
    (resume) => {
      if (!resume || origin()) return;
      const { query, status, priority, scroll: left } = resume.context;
      Object.assign(preferences, { query, status, priority, boardScroll: left });
      if (scroll.value) scroll.value.scrollLeft = left;
    },
    { immediate: true },
  );

  return (pbiId: string): BacklogBoardContext => {
    const { query, status, priority, boardScroll } = preferences;
    return { pbiId, query, status, priority, scroll: scroll.value?.scrollLeft ?? boardScroll };
  };
}
