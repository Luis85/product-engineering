<script setup lang="ts">
import UButton from "@nuxt/ui/components/Button.vue";
import { computed, nextTick, ref, shallowRef, useId, watch } from "vue";
import type { BacklogSnapshot } from "../../application/backlog";
import {
  moveStoryMapNode,
  readStoryMapForEdit,
  storyMapNodeToEdit,
} from "../../application/story-maps";
import type { StoryMapNodeEdit, StoryMapRecord } from "../../application/story-maps";
import type { StoryMapSlice } from "../../domain/story-maps";
import { useWorkspaceOriginKey, useWorkspaceRouteFocus } from "../projects";
import { ErrorNotice, useCommand, useMessages, useNavigationGuard, useQuery } from "../shell";
import StoryMapBand from "./StoryMapBand.vue";
import StoryMapBackbone from "./StoryMapBackbone.vue";
import StoryMapNodeEditor from "./StoryMapNodeEditor.vue";
import StoryMapOrderButtons from "./StoryMapOrderButtons.vue";
import type { StoryMapColumn } from "./journey-types";

const {
  map,
  backlog,
  cardId = undefined,
} = defineProps<{
  readonly map: StoryMapRecord;
  readonly backlog: BacklogSnapshot;
  readonly cardId?: string | undefined;
}>();
defineSlots<{ "slice-review"?: (scope: { readonly slice: StoryMapSlice }) => unknown }>();
const text = useMessages()["story-maps"];
const prefix = useId();
const section = ref<HTMLElement>();
const scroll = ref<HTMLElement>();
const editing = shallowRef<{ readonly base: StoryMapRecord; readonly edit: StoryMapNodeEdit }>();
const read = useQuery(readStoryMapForEdit);
const moving = useCommand(moveStoryMapNode);
const originKey = useWorkspaceOriginKey();
const focusRouteControl = useWorkspaceRouteFocus();
const message = computed(() => read.message.value ?? moving.message.value);
let trigger: HTMLElement | undefined;
let target: string | undefined;
let position = 0;
let verticalPosition = 0;
useNavigationGuard(() => !moving.pending.value);
const activities = computed(() =>
  map.activities.map((activity) => ({
    ...activity,
    steps: map.steps.filter(({ activityId }) => activityId === activity.id),
  })),
);
const columns = computed(() =>
  activities.value.flatMap<StoryMapColumn>((activity) =>
    activity.steps.length
      ? activity.steps.map(({ id, title }) => ({ key: id, id, title, activity }))
      : [{ key: activity.id, id: undefined, title: text.journey.missingStep, activity }],
  ),
);

watch(
  () => map,
  () => {
    if (target) restore();
  },
  { flush: "post" },
);
watch(
  [() => cardId, section],
  ([id]) => {
    if (!id || originKey()?.startsWith("slice-review-")) return;
    const control = findNode(id);
    control?.scrollIntoView({ block: "nearest", inline: "nearest" });
    if (control) focusRouteControl(control);
  },
  { flush: "post" },
);

function remember(origin: HTMLElement | undefined) {
  trigger = origin;
  position = scroll.value?.scrollLeft ?? 0;
  verticalPosition = scroll.value?.scrollTop ?? 0;
}

function findNode(id: string) {
  return Array.from(section.value?.querySelectorAll<HTMLElement>("[data-story-node]") ?? []).find(
    (element) => element.dataset.storyNode === id,
  );
}

function restore() {
  const control = target && findNode(target);
  if (target && !control) return;
  (control || trigger)?.focus({ preventScroll: true });
  if (scroll.value) {
    scroll.value.scrollLeft = position;
    scroll.value.scrollTop = verticalPosition;
  }
  target = undefined;
  trigger = undefined;
}

async function edit(value: StoryMapNodeEdit, origin?: HTMLElement) {
  remember(origin);
  const result = await read.run(map);
  if (result._tag !== "success") return;
  const current = storyMapNodeToEdit(result.value, value);
  if (current) editing.value = { base: result.value, edit: current };
}

function dismiss(id?: string) {
  target = id ?? editing.value?.edit.node.id;
  editing.value = undefined;
  void nextTick(() => restore());
}

async function move(
  kind: StoryMapNodeEdit["kind"],
  id: string,
  offset: -1 | 1,
  origin?: HTMLElement,
) {
  remember(origin);
  await moving.run(map, kind, id, offset);
  target = id;
  void nextTick(() => restore());
}
</script>

<template>
  <section ref="section" class="pe-story-journey" :aria-labelledby="prefix + '-journey'">
    <header class="pe-story-journey-heading">
      <h2 :id="prefix + '-journey'">{{ text.journey.title }}</h2>
      <div class="pe:flex pe:flex-wrap pe:gap-1">
        <UButton
          type="button"
          color="neutral"
          variant="soft"
          icon="i-lucide-plus"
          data-testid="story-map-add-activity"
          :label="text.journey.add.activity"
          @click="
            edit(
              { kind: 'activity', node: { id: '', title: '' } },
              $event.currentTarget as HTMLElement,
            )
          "
        />
        <UButton
          type="button"
          color="neutral"
          variant="soft"
          icon="i-lucide-plus"
          data-testid="story-map-add-slice"
          :label="text.journey.add.slice"
          @click="
            edit(
              { kind: 'slice', node: { id: '', title: '' } },
              $event.currentTarget as HTMLElement,
            )
          "
        />
      </div>
    </header>
    <ErrorNotice v-if="message" :message="message" />
    <p v-if="!columns.length" class="pe-story-maps-empty">{{ text.journey.empty }}</p>
    <div
      v-else
      ref="scroll"
      class="pe-story-scroll"
      role="region"
      tabindex="0"
      data-testid="story-map-scroll"
      :data-pe-scroll-key="map.id"
      :aria-label="text.journey.region"
      :style="{ '--pe-story-columns': columns.length }"
    >
      <div class="pe-story-board">
        <StoryMapBackbone :activities="activities" @edit="edit" @move="move" />
        <template v-if="map.steps.length">
          <p class="pe-story-release-axis">{{ text.journey.releaseAxis }}</p>
          <StoryMapBand
            v-for="(slice, index) in map.slices"
            :key="slice.id"
            :map="map"
            :slice="slice"
            :columns="columns"
            :backlog="backlog"
            @edit="edit"
            @move="move"
          >
            <template #slice-actions>
              <slot name="slice-review" :slice="slice" />
              <UButton
                type="button"
                variant="ghost"
                color="neutral"
                size="xs"
                :label="text.journey.editSliceShort"
                :aria-label="text.journey.edit.slice"
                :data-story-node="slice.id"
                :data-testid="'story-map-edit-slice-' + slice.id"
                @click="edit({ kind: 'slice', node: slice }, $event.currentTarget as HTMLElement)"
              />
              <StoryMapOrderButtons
                :index="index"
                :length="map.slices.length"
                vertical
                compact
                @move="(offset) => move('slice', slice.id, offset)"
              />
            </template>
          </StoryMapBand>
          <StoryMapBand
            :map="map"
            :columns="columns"
            :backlog="backlog"
            @edit="edit"
            @move="move"
          />
        </template>
      </div>
    </div>
    <StoryMapNodeEditor
      v-if="editing"
      :map="editing.base"
      :edit="editing.edit"
      @dismiss="dismiss"
    />
  </section>
</template>
