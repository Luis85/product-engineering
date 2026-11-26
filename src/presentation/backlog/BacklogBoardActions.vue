<script setup lang="ts">
import { computed } from "vue";
import { pbiCompanions } from "../../application/backlog";
import type { BacklogItem, BacklogSnapshot } from "../../application/backlog";
import type { ProjectId } from "../../application/projects";
import { backlogPrototypeSource } from "../../application/prototypes";
import { PrototypeCreateAction } from "../prototypes";
import { useMessages } from "../shell";
import PbiCompanions from "./PbiCompanions.vue";

const { project, item, snapshot } = defineProps<{
  readonly project: ProjectId;
  readonly item: BacklogItem;
  readonly snapshot: BacklogSnapshot;
}>();
const text = useMessages().backlog;
const source = computed(() => backlogPrototypeSource(project, item));
const companionCount = computed(() => {
  if (!item.adopted) return "";
  const { open, total } = pbiCompanions(snapshot.items, item);
  return total ? text.companions.count(open, total) : "";
});
const actionsLabel = computed(() =>
  [text.board.actionsFor(item.title), companionCount.value].filter(Boolean).join(" · "),
);
</script>

<template>
  <details v-if="item.adopted || source" class="pe-board-actions" data-pe-restore-disclosure>
    <summary :aria-label="actionsLabel">
      {{ text.board.actions }}
      <span v-if="companionCount" data-testid="board-companion-count" class="pe-board-action-count">
        {{ companionCount }}
      </span>
    </summary>
    <div class="pe-board-action-items">
      <PbiCompanions
        v-if="item.adopted"
        :project="project"
        :item="item"
        :snapshot="snapshot"
        compact
      />
      <PrototypeCreateAction v-if="source" :project-id="project" :source="source" />
    </div>
  </details>
</template>
