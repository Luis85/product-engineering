<script setup lang="ts">
import UButton from "@nuxt/ui/components/Button.vue";
import UIcon from "@nuxt/ui/components/Icon.vue";
import { useId } from "vue";
import type { BoardStage } from "../../domain/backlog";
import { useMessages } from "../shell";

const { stage, count, foldable, folded, dropTarget } = defineProps<{
  readonly stage: BoardStage;
  readonly count: number;
  readonly foldable: boolean;
  readonly folded: boolean;
  readonly dropTarget: boolean;
}>();
const emit = defineEmits<{
  fold: [];
  over: [DragEvent];
  drop: [DragEvent];
  create: [HTMLElement];
}>();
const text = useMessages().backlog.board;
const bodyId = useId();
const stageIcons = {
  Backlog: "i-lucide-list-tree",
  Open: "i-lucide-circle",
  "In Progress": "i-lucide-clock",
  Review: "i-lucide-eye",
  "In Development": "i-lucide-code",
  Done: "i-lucide-check",
} satisfies Record<BoardStage, string>;
</script>

<template>
  <section
    class="pe-board-lane"
    :data-board-stage="stage"
    :data-drop-target="dropTarget"
    :data-folded="folded"
    :aria-label="text.stages[stage]"
    @dragover="emit('over', $event)"
    @drop="emit('drop', $event)"
  >
    <header class="pe-board-lane-head">
      <span class="pe-board-stage-mark" aria-hidden="true">
        <UIcon :name="stageIcons[stage]" class="pe:size-4" />
      </span>
      <h3>{{ text.stages[stage] }}</h3>
      <span data-testid="board-lane-count" :aria-label="text.count(count)">{{ count }}</span>
      <UButton
        v-if="foldable"
        type="button"
        color="neutral"
        variant="ghost"
        :icon="folded ? 'i-lucide-chevron-right' : 'i-lucide-chevron-down'"
        :aria-controls="bodyId"
        :aria-expanded="!folded"
        :aria-label="text.fold(text.stages[stage], folded)"
        :data-pe-focus-key="'board-fold-' + stage"
        @click="emit('fold')"
      />
    </header>
    <div :id="bodyId" v-show="!folded" class="pe-board-stack">
      <slot />
      <p v-if="!count && stage !== 'Backlog'" class="pe-board-empty">{{ text.empty }}</p>
    </div>
    <UButton
      v-if="stage === 'Backlog'"
      type="button"
      variant="outline"
      color="neutral"
      icon="i-lucide-plus"
      class="pe-board-add"
      data-testid="board-new"
      :aria-label="text.create"
      @click="emit('create', $event.currentTarget as HTMLElement)"
      ><span class="pe-board-add-label">{{ text.create }}</span></UButton
    >
  </section>
</template>
