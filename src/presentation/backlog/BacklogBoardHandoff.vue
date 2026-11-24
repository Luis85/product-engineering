<script setup lang="ts">
import UButton from "@nuxt/ui/components/Button.vue";
import { computed, shallowRef, watch } from "vue";
import { inspectBoardPreparation } from "../../application/backlog";
import type {
  BacklogItem,
  BacklogSnapshot,
  BacklogBoardContext,
  BoardRequestHandoff,
  PbiPreparation,
  PbiPreparationGap,
} from "../../application/backlog";
import type { FeatureRequest } from "../../application/feature-requests";
import type { FeatureRequestOrigin } from "../../application/feature-requests";
import type { KnowledgeRecord } from "../../application/knowledge";
import type { ProjectId } from "../../application/projects";
import { FeatureRequestCreate, FeatureRequestLinks } from "../feature-requests";
import { useRestoreWorkspacePosition } from "../projects";
import { useMessages, useQuery } from "../shell";

const { project, item, snapshot, bodyChange, handoff, requestOrigin, resumedRequest } =
  defineProps<{
    readonly project: ProjectId;
    readonly item: BacklogItem;
    readonly snapshot: BacklogSnapshot;
    readonly bodyChange: { readonly path: string } | undefined;
    readonly handoff: BoardRequestHandoff<FeatureRequest>;
    readonly requestOrigin: (pbiId: string) => BacklogBoardContext;
    readonly resumedRequest: string | undefined;
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
const focusKey = computed(() => "board-request-" + item.key);
const from = (): FeatureRequestOrigin => ({ kind: "board", context: requestOrigin(item.key) });
const git = computed(
  () => gap.value?.reason === "gitPending" || gap.value?.reason === "gitUnavailable",
);
const gapLabel = computed(() => {
  const current = gap.value;
  if (!current) return "";
  return [text.pbiGates.reasons[current.reason], current.record?.displayId]
    .filter(Boolean)
    .join(" · ");
});
const actionId = computed(() => (git.value ? "board-git" : "board-prepare"));

function act(event: MouseEvent) {
  const current = gap.value;
  if (!current) return;
  const control = event.currentTarget as HTMLElement;
  if (git.value) emit("git", control, current.record);
  else emit("prepare", control, current);
}
async function refresh() {
  if (!item.id || handoff.active) return;
  const result = await query.run(project, item.id);
  if (result._tag === "success") preparation.value = result.value;
  if (result._tag === "failure") preparation.value = undefined;
}

watch([() => snapshot, () => handoff.active?.id], refresh, { immediate: true });
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
    <FeatureRequestLinks
      :project="project"
      :handoff="handoff"
      :focus-key="focusKey"
      :from="from"
      :resume="resumedRequest"
    />
    <template v-if="!handoff.active">
      <template v-if="gap">
        <span>{{ gapLabel }}</span>
        <UButton
          type="button"
          size="sm"
          variant="link"
          :data-testid="actionId"
          :data-pe-focus-key="actionId + '-' + item.key"
          :label="git ? text.board.git : text.board.prepare"
          @click="act"
        />
      </template>
      <template v-else-if="preparation?.ready">
        <span>{{ text.pbiGates.ready }}</span>
        <FeatureRequestCreate
          v-if="item.id"
          :project="project"
          :source="{ id: item.id, title: item.title }"
          :focus-key="focusKey"
          :from="from"
        />
      </template>
      <span v-else-if="query.message.value">{{ query.message.value.title }}</span>
      <span v-else>{{ text.pbiGates.checking }}</span>
    </template>
  </div>
</template>
