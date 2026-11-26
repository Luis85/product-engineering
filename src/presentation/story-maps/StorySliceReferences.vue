<script setup lang="ts">
import UButton from "@nuxt/ui/components/Button.vue";
import type { BacklogItem } from "../../application/backlog";
import type { storySliceStories } from "../../application/story-maps";
import { useMessages } from "../shell";

defineProps<{
  readonly cardId: string;
  readonly links: ReturnType<typeof storySliceStories>[number]["links"];
}>();
const emit = defineEmits<{ open: [BacklogItem, MouseEvent] }>();
const catalogs = useMessages();
const storyText = catalogs["story-maps"];
const text = storyText.handoff;

function referenceType(item: BacklogItem, created: boolean) {
  if (item.kind === "UC") return created ? text.created : text.existing;
  return text.linked + " · " + catalogs.backlog.types[item.kind];
}
</script>

<template>
  <ul v-if="links.length" class="pe-story-slice-links" :aria-label="storyText.journey.linkedItems">
    <li v-for="({ reference, item, created }, index) in links" :key="index">
      <template v-if="item">
        <span>{{ referenceType(item, created) }}</span>
        <UButton
          type="button"
          variant="link"
          color="neutral"
          class="pe:p-0 pe:wrap-anywhere pe:whitespace-normal pe:text-start"
          :data-story-item="item.id"
          :data-pe-focus-key="'slice-item-' + cardId + '-' + item.id"
          @click="emit('open', item, $event)"
          >{{ item.id }} · {{ item.title }}</UButton
        >
      </template>
      <span v-else>{{ reference.recordId }} · {{ storyText.errors.target }}</span>
    </li>
  </ul>
</template>
