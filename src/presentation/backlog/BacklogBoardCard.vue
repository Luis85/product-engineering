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
import { backlogPrototypeSource } from "../../application/prototypes";
import { boardStages } from "../../domain/backlog";
import type { BoardStage } from "../../domain/backlog";
import { PrototypeCreateAction } from "../prototypes";
import { useMessages } from "../shell";
import BacklogBoardHandoff from "./BacklogBoardHandoff.vue";
import PbiCompanions from "./PbiCompanions.vue";

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
const source = computed(() => backlogPrototypeSource(project, item));

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
      <span><UIcon name="i-lucide-book-open" aria-hidden="true" /> {{ identity }}</span>
      <span v-if="item.priority"
        ><UIcon name="i-lucide-flag" aria-hidden="true" /> {{ item.priority }}</span
      >
      <PrototypeCreateAction
        v-if="source"
        :project-id="project"
        :source="source"
        :display-id="identity"
        compact
      />
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
    <PbiCompanions
      v-if="item.adopted"
      :project="project"
      :item="item"
      :snapshot="snapshot"
      compact
    />
    <div class="pe-board-card-meta">
      <span
        ><UIcon name="i-lucide-user" aria-hidden="true" />
        {{ ownerName(item.owner) || text.unassigned }}</span
      >
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
  </article>
</template>
