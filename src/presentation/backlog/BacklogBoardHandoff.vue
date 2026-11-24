<script setup lang="ts">
import UButton from "@nuxt/ui/components/Button.vue";
import { computed, shallowRef, watch } from "vue";
import { inspectBoardPreparation } from "../../application/backlog";
import type {
  BacklogItem,
  BacklogSnapshot,
  PbiPreparation,
  PbiPreparationGap,
} from "../../application/backlog";
import type { KnowledgeRecord } from "../../application/knowledge";
import type { ProjectId } from "../../application/projects";
import { useRestoreWorkspacePosition } from "../projects";
import { useMessages, useQuery } from "../shell";

const { project, item, snapshot, bodyChange } = defineProps<{
  readonly project: ProjectId;
  readonly item: BacklogItem;
  readonly snapshot: BacklogSnapshot;
  readonly bodyChange: { readonly path: string } | undefined;
}>();
const emit = defineEmits<{
  prepare: [control: HTMLElement, gap: PbiPreparationGap];
  git: [control: HTMLElement, record?: KnowledgeRecord];
}>();
const text = useMessages().backlog;
const restorePosition = useRestoreWorkspacePosition();
const query = useQuery(inspectBoardPreparation);
const preparation = shallowRef<PbiPreparation>();
const gap = computed(() => preparation.value?.gaps[0]);
const git = computed(
  () => gap.value?.reason === "gitPending" || gap.value?.reason === "gitUnavailable",
);
async function refresh() {
  if (!item.id) return;
  const result = await query.run(project, item.id);
  if (result._tag === "success") preparation.value = result.value;
  if (result._tag === "failure") preparation.value = undefined;
}

watch(() => snapshot, refresh, { immediate: true });
watch(
  () => bodyChange,
  (change) => {
    if (!change) return;
    const inputs = preparation.value?.inputs;
    if (change.path === item.path || inputs?.some(({ record }) => record?.path === change.path))
      refresh();
  },
);
watch(gap, () => restorePosition(), { flush: "post" });
</script>

<template>
  <div class="pe-board-handoff" :aria-busy="query.pending.value">
    <strong>{{ text.board.request }}</strong>
    <template v-if="gap">
      <span>
        {{ text.pbiGates.reasons[gap.reason]
        }}<template v-if="gap.record"> · {{ gap.record.displayId }}</template>
      </span>
      <UButton
        v-if="git"
        type="button"
        size="sm"
        variant="link"
        data-testid="board-git"
        :data-pe-focus-key="'board-git-' + item.key"
        :label="text.board.git"
        @click="emit('git', $event.currentTarget as HTMLElement, gap.record)"
      />
      <UButton
        v-else
        type="button"
        size="sm"
        variant="link"
        data-testid="board-prepare"
        :data-pe-focus-key="'board-prepare-' + item.key"
        :label="text.board.prepare"
        @click="emit('prepare', $event.currentTarget as HTMLElement, gap)"
      />
    </template>
    <span v-else-if="preparation?.ready">{{ text.pbiGates.ready }}</span>
    <span v-else-if="query.message.value">{{ query.message.value.title }}</span>
    <span v-else>{{ text.pbiGates.checking }}</span>
  </div>
</template>
