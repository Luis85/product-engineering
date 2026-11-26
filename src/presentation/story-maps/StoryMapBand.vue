<script setup lang="ts">
import UButton from "@nuxt/ui/components/Button.vue";
import { computed, useId } from "vue";
import type { BacklogSnapshot } from "../../application/backlog";
import { storyMapCardsForCell } from "../../application/story-maps";
import type { StoryMapNodeEdit, StoryMapRecord } from "../../application/story-maps";
import type { StoryMapSlice } from "../../domain/story-maps";
import { useMessages } from "../shell";
import StoryMapCard from "./StoryMapCard.vue";
import type { StoryMapColumn } from "./journey-types";

const {
  map,
  slice = undefined,
  columns,
  backlog,
} = defineProps<{
  readonly map: StoryMapRecord;
  readonly slice?: StoryMapSlice;
  readonly columns: readonly StoryMapColumn[];
  readonly backlog: BacklogSnapshot;
}>();
const emit = defineEmits<{
  edit: [edit: StoryMapNodeEdit, origin?: HTMLElement];
  move: [kind: StoryMapNodeEdit["kind"], id: string, offset: -1 | 1, origin?: HTMLElement];
}>();
const text = useMessages()["story-maps"];
const id = useId();
const title = computed(() => slice?.title ?? text.journey.unsliced);
const bandKey = computed(() => slice?.id ?? "unsliced");
const outcome = computed(() => slice?.outcome);
const cells = computed(() =>
  columns.map((column) => ({
    ...column,
    cards: storyMapCardsForCell(map, column.id, slice?.id),
    add: text.journey.addStory(column.title, title.value),
  })),
);
const count = computed(() => cells.value.reduce((sum, cell) => sum + cell.cards.length, 0));

function addCard(stepId: string, event: MouseEvent) {
  const node = { id: "", title: "", stepId, ...(slice && { sliceId: slice.id }) };
  emit("edit", { kind: "card", node }, event.currentTarget as HTMLElement);
}
</script>

<template>
  <section
    class="pe-story-grid pe-story-band"
    :aria-labelledby="id"
    :data-testid="'story-map-band-' + bandKey"
  >
    <header class="pe-story-slice-header" :data-testid="'story-map-slice-header-' + bandKey">
      <div>
        <h3 :id="id">{{ title }}</h3>
        <p v-if="outcome">{{ outcome }}</p>
      </div>
      <div v-if="slice" class="pe-story-slice-actions">
        <slot name="slice-actions" :slice="slice" />
      </div>
    </header>
    <p class="pe-story-band-count">
      {{ text.storyCount(count) }}
    </p>
    <div
      v-for="column in cells"
      :key="column.key"
      class="pe-story-cell"
      :aria-label="column.title"
      :data-testid="`story-map-cell-${bandKey}-${column.key}`"
    >
      <p class="pe-story-mobile-step">
        <span>{{ column.activity.title }}</span> <strong>{{ column.title }}</strong>
      </p>
      <StoryMapCard
        v-for="(card, index) in column.cards"
        :key="card.id"
        :map="map"
        :backlog="backlog"
        :card="card"
        :index="index"
        :length="column.cards.length"
        @edit="(origin) => emit('edit', { kind: 'card', node: card }, origin)"
        @move="(offset, origin) => emit('move', 'card', card.id, offset, origin)"
      />
      <UButton
        v-if="column.id"
        type="button"
        size="xs"
        variant="ghost"
        color="neutral"
        icon="i-lucide-plus"
        class="pe:justify-self-start pe:self-start"
        :aria-label="column.add"
        @click="addCard(column.id, $event)"
      />
    </div>
  </section>
</template>
