<script setup lang="ts">
import UButton from "@nuxt/ui/components/Button.vue";
import { computed } from "vue";
import type { BacklogItem } from "../../application/backlog";
import type { UserMessage } from "../../application/shell";
import type { storySliceStories } from "../../application/story-maps";
import { ErrorNotice, useMessages } from "../shell";
import StorySliceReferences from "./StorySliceReferences.vue";

const { story, actionable, busy, recovering, message } = defineProps<{
  readonly story: ReturnType<typeof storySliceStories>[number];
  readonly actionable: boolean;
  readonly busy: boolean;
  readonly recovering: boolean;
  readonly message: UserMessage | undefined;
}>();
const emit = defineEmits<{
  begin: [string, "create" | "link"];
  defer: [string, boolean];
  open: [BacklogItem, MouseEvent];
  openStory: [string, MouseEvent];
}>();
const text = useMessages()["story-maps"].handoff;
const decision = computed(() =>
  story.covered ? text.covered : story.deferred ? text.deferred : text.open,
);
const actions = computed(() => {
  const create = {
    label: recovering ? text.retry : text.create,
    icon: "i-lucide-plus",
    variant: "soft",
    color: "primary",
    run: () => emit("begin", story.card.id, "create"),
  } as const;
  const link = {
    label: text.link,
    icon: "i-lucide-link",
    variant: "ghost",
    color: "neutral",
    run: () => emit("begin", story.card.id, "link"),
  } as const;
  const defer = {
    label: text.defer,
    icon: undefined,
    variant: "ghost",
    color: "neutral",
    run: () => emit("defer", story.card.id, true),
  } as const;
  const resume = {
    label: text.resume,
    icon: undefined,
    variant: "soft",
    color: "neutral",
    run: () => emit("defer", story.card.id, false),
  } as const;
  if (story.recoverySlice)
    return [
      {
        label: text.openStory,
        icon: undefined,
        variant: "soft",
        color: "neutral",
        run: (event: MouseEvent) => emit("openStory", story.card.id, event),
      },
    ] as const;
  if (!actionable) return [];
  if (story.deferred) return [resume];
  if (story.covered) return [link];
  return recovering ? [create] : [create, link, defer];
});
</script>

<template>
  <article
    tabindex="-1"
    class="pe-story-slice-row"
    :data-testid="'slice-review-story-' + story.card.id"
    :data-slice-story="story.card.id"
    :data-pe-focus-key="'slice-story-' + story.card.id"
  >
    <p class="pe-story-slice-step">{{ story.activity.title }} › {{ story.step.title }}</p>
    <div class="pe-story-slice-heading">
      <h2>{{ story.card.title }}</h2>
      <span class="pe-story-slice-decision" :data-covered="story.covered">{{ decision }}</span>
    </div>
    <p v-if="story.card.description">{{ story.card.description }}</p>
    <p v-if="story.recoverySlice" class="pe:text-sm" role="status">
      {{ text.restoreSlice(story.recoverySlice) }}
    </p>
    <StorySliceReferences
      :card-id="story.card.id"
      :links="story.links"
      @open="(...args) => emit('open', ...args)"
    />
    <div v-if="actions.length" class="pe-story-slice-actions">
      <UButton
        v-for="{ label, icon, variant, color, run } in actions"
        :key="label"
        type="button"
        size="sm"
        :label="label"
        :icon="icon"
        :variant="variant"
        :color="color"
        :disabled="busy"
        @click="run"
      />
    </div>
    <ErrorNotice v-if="message" :message="message" />
  </article>
</template>
