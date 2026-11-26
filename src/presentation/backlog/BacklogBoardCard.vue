<script setup lang="ts">
import UButton from "@nuxt/ui/components/Button.vue";
import UIcon from "@nuxt/ui/components/Icon.vue";
import { computed } from "vue";
import { ownerName } from "../../application/backlog";
import type {
  BacklogBoardContext,
  BacklogItem,
  BacklogSnapshot,
  BoardRequestHandoff,
  PbiPreparationGap,
} from "../../application/backlog";
import type { FeatureRequest } from "../../application/feature-requests";
import type { KnowledgeRecord } from "../../application/knowledge";
import type { ProjectId } from "../../application/projects";
import { boardStages } from "../../domain/backlog";
import type { BoardStage } from "../../domain/backlog";
import { useMessages } from "../shell";
import BacklogBoardActions from "./BacklogBoardActions.vue";
import BacklogBoardHandoff from "./BacklogBoardHandoff.vue";

const {
  item,
  feature,
  project,
  snapshot,
  bodyChange,
  stage,
  busy,
  handoff,
  requestOrigin,
  resumedRequest,
} = defineProps<{
  readonly item: BacklogItem;
  readonly feature: string | undefined;
  readonly project: ProjectId;
  readonly snapshot: BacklogSnapshot;
  readonly bodyChange: { readonly path: string } | undefined;
  readonly stage: BoardStage;
  readonly busy: boolean;
  readonly handoff: BoardRequestHandoff<FeatureRequest>;
  readonly requestOrigin: (pbiId: string) => BacklogBoardContext;
  readonly resumedRequest: string | undefined;
}>();
const emit = defineEmits<{
  open: [HTMLElement];
  prepare: [HTMLElement, PbiPreparationGap];
  git: [HTMLElement, KnowledgeRecord?];
  move: [BoardStage];
  dragStart: [DragEvent];
  dragEnd: [];
}>();
const text = useMessages().backlog;
const identity = computed(() => item.id ?? String(item.fields["pbl-id"] ?? text.board.legacy));
const owner = computed(() => ownerName(item.owner));

function change(event: Event) {
  const control = event.currentTarget as HTMLSelectElement;
  const target = boardStages.find((candidate) => candidate === control.value);
  control.value = stage;
  if (target) emit("move", target);
}
</script>

<template>
  <article
    class="pe-board-card"
    :data-board-card="item.key"
    :aria-label="identity + ' · ' + item.title"
    :draggable="item.adopted && !busy"
    @dragstart="emit('dragStart', $event)"
    @dragend="emit('dragEnd')"
  >
    <div class="pe-board-card-meta">
      <span>{{ identity }}</span>
      <span v-if="item.priority" class="pe-backlog-priority" :data-priority="item.priority">
        {{ item.priority }}
      </span>
    </div>
    <UButton
      type="button"
      color="neutral"
      variant="link"
      data-testid="board-card-open"
      class="pe-board-card-title"
      :data-pe-focus-key="'board-card-' + item.key"
      @click="emit('open', $event.currentTarget as HTMLElement)"
      ><span>{{ item.title }}</span></UButton
    >
    <p v-if="feature" class="pe-board-feature">{{ feature }}</p>
    <div v-if="owner || item.adopted" class="pe-board-card-meta pe-board-card-footer">
      <span v-if="owner"><UIcon name="i-lucide-user" aria-hidden="true" /> {{ owner }}</span>
      <select
        v-if="item.adopted"
        :value="stage"
        :aria-label="text.board.move(identity)"
        :disabled="busy"
        data-testid="board-move"
        :data-pe-focus-key="'board-move-' + item.key"
        @change="change"
      >
        <option v-for="option in boardStages" :key="option" :value="option">
          {{ text.board.stages[option] }}
        </option>
      </select>
    </div>
    <BacklogBoardHandoff
      v-if="item.adopted"
      :project="project"
      :item="item"
      :snapshot="snapshot"
      :body-change="bodyChange"
      :handoff="handoff"
      :request-origin="requestOrigin"
      :resumed-request="resumedRequest"
      @prepare="(control, gap) => emit('prepare', control, gap)"
      @git="(control, record) => emit('git', control, record)"
    />
    <BacklogBoardActions :project="project" :item="item" :snapshot="snapshot" />
  </article>
</template>
