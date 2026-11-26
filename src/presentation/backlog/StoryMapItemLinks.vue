<script setup lang="ts">
import UButton from "@nuxt/ui/components/Button.vue";
import { computed, watch } from "vue";
import type { ProjectId } from "../../application/projects";
import {
  storyMapItemBacklinks,
  storyMapsChanges,
  storyMapsRoute,
  storyMapsSnapshot,
} from "../../application/story-maps";
import type { StoryMapId } from "../../domain/story-maps";
import { useRememberWorkspaceOrigin, useRestoreWorkspacePosition } from "../projects";
import { useMessages, useNavigate, useStream } from "../shell";

const { project, item = undefined } = defineProps<{
  readonly project: ProjectId;
  readonly item?: string | undefined;
}>();
const text = useMessages()["story-maps"];
const maps = useStream(storyMapsSnapshot(project), storyMapsChanges(project));
const links = computed(() => (item ? storyMapItemBacklinks(project, item, maps.value.maps) : []));
const navigate = useNavigate();
const remember = useRememberWorkspaceOrigin();
const restore = useRestoreWorkspacePosition();
watch(links, () => restore(), { flush: "post" });

async function open(mapId: StoryMapId, cardId: string, event: MouseEvent) {
  remember(event.currentTarget as HTMLElement);
  if (!(await navigate(storyMapsRoute(project, mapId, cardId)))) remember(undefined);
}
</script>

<template>
  <section
    v-if="links.length"
    class="pe:grid pe:min-w-0 pe:gap-1"
    :aria-label="text.title"
    data-testid="backlog-story-map-links"
  >
    <h3 class="pe:font-semibold">{{ text.title }}</h3>
    <ul class="pe:grid pe:min-w-0 pe:gap-1">
      <li v-for="{ map, card } in links" :key="map.id + '/' + card.id">
        <UButton
          type="button"
          variant="link"
          class="pe:p-0 pe:wrap-anywhere pe:text-start"
          :data-map-card-link="card.id"
          :data-pe-focus-key="'backlog-story-' + map.id + '-' + card.id"
          @click="open(map.id, card.id, $event)"
          >{{ map.displayId }} · {{ map.title }} · {{ card.title }}</UButton
        >
      </li>
    </ul>
  </section>
</template>
