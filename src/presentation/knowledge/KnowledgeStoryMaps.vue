<script setup lang="ts">
import UButton from "@nuxt/ui/components/Button.vue";
import { computed } from "vue";
import type { ProjectId } from "../../application/projects";
import {
  storyMapBacklinks,
  storyMapsChanges,
  storyMapsRoute,
  storyMapsSnapshot,
} from "../../application/story-maps";
import type { KnowledgeId } from "../../domain/knowledge";
import type { StoryMapId } from "../../domain/story-maps";
import { useRememberWorkspaceOrigin } from "../projects";
import { useMessages, useNavigate, useStream } from "../shell";
import { StoryMapCreateDialog } from "../story-maps";

const { projectId, recordId, kind, sourcePath, creating } = defineProps<{
  readonly projectId: ProjectId;
  readonly recordId: KnowledgeId;
  readonly kind: "prd" | "jtbd";
  readonly sourcePath: string;
  readonly creating: boolean;
}>();
const emit = defineEmits<{ dismiss: [StoryMapId?] }>();
const text = useMessages()["story-maps"];
const maps = useStream(storyMapsSnapshot(projectId), storyMapsChanges(projectId));
const backlinks = computed(() => storyMapBacklinks(projectId, recordId, maps.value.maps, kind));
const navigate = useNavigate();
const remember = useRememberWorkspaceOrigin();

function open(id: StoryMapId, event: Event) {
  remember(event.currentTarget as HTMLElement);
  void navigate(storyMapsRoute(projectId, id));
}
</script>

<template>
  <section v-if="backlinks.length" class="pe:grid pe:min-w-0 pe:gap-1">
    <h2 class="pe:text-base pe:font-semibold">{{ text.title }}</h2>
    <ul class="pe:grid pe:gap-1">
      <li v-for="map in backlinks" :key="map.id">
        <UButton
          type="button"
          color="neutral"
          variant="link"
          class="pe:wrap-anywhere pe:text-start"
          data-testid="knowledge-story-map-backlink"
          :data-pe-focus-key="map.id"
          @click="open(map.id, $event)"
          >{{ map.displayId }} · {{ map.title }}</UButton
        >
      </li>
    </ul>
  </section>
  <StoryMapCreateDialog
    v-if="creating"
    :project-id="projectId"
    :prd-id="recordId"
    :source-path="sourcePath"
    @dismiss="emit('dismiss', $event)"
  />
</template>
