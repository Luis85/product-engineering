<script setup lang="ts">
import UButton from "@nuxt/ui/components/Button.vue";
import UIcon from "@nuxt/ui/components/Icon.vue";
import { computed, nextTick, onMounted, ref, watch } from "vue";
import { backlogChanges } from "../../application/backlog";
import type { BacklogSnapshot } from "../../application/backlog";
import { projectChanges, projectSnapshot } from "../../application/projects";
import {
  storyMapRows,
  storyMapsChanges,
  storyMapsRoute,
  storyMapsSnapshot,
} from "../../application/story-maps";
import type { StoryMapId } from "../../domain/story-maps";
import { useRememberWorkspaceOrigin, useRestoreWorkspacePosition } from "../projects";
import { useAsyncStream, useMessages, useNavigate, useStream } from "../shell";
import StoryMapCreateDialog from "./StoryMapCreateDialog.vue";
import StoryMapDetail from "./StoryMapDetail.vue";

const { scope } = defineProps<{ readonly scope: ReturnType<typeof storyMapsRoute> }>();
const projectId = scope.projectId;
const catalog = useMessages();
const text = catalog["story-maps"];
const projects = useStream(projectSnapshot, projectChanges);
const maps = useStream(storyMapsSnapshot(projectId), storyMapsChanges(projectId));
const backlog = useAsyncStream<BacklogSnapshot, never>(
  { ready: false, items: [], duplicates: [] },
  backlogChanges(projectId),
);
const rows = computed(() => storyMapRows(maps.value.maps, backlog.value.items));
const project = computed(() => projects.value.projects.find(({ id }) => id === projectId));
const current = computed(
  () => project.value && maps.value.maps.find(({ id }) => scope.mapId === id),
);
const ready = computed(
  () => projects.value.ready && maps.value.ready && (backlog.value.ready || !rows.value.length),
);
const status = computed(() => {
  if (projects.value.failed || maps.value.failed)
    return { label: catalog.projects.unavailable, role: "alert" };
  if (!ready.value) return { label: text.loading, role: "status" };
  if (!project.value || scope.mapId) return { label: text.missing, role: "status" };
  return rows.value.length ? undefined : { label: text.empty, role: "status", empty: true };
});
const navigate = useNavigate();
const remember = useRememberWorkspaceOrigin();
const restore = useRestoreWorkspacePosition();
const creating = ref(false);
let trigger: HTMLElement | undefined;
onMounted(() => restore());
watch([maps, () => scope.mapId, () => backlog.value.ready], () => restore(), { flush: "post" });

function openMap(id: StoryMapId, origin?: HTMLElement) {
  remember(origin);
  void navigate(storyMapsRoute(projectId, id));
}

function start(event: Event) {
  trigger = event.currentTarget as HTMLElement;
  creating.value = true;
}

async function dismiss(id?: StoryMapId) {
  creating.value = false;
  if (id) openMap(id, trigger);
  else await nextTick(() => trigger?.focus({ preventScroll: true }));
}
</script>

<template>
  <StoryMapDetail
    v-if="current"
    :key="current.id"
    :map="current"
    :backlog="backlog"
    :card-id="scope.cardId"
  />
  <section v-else class="pe-story-maps" data-testid="story-maps">
    <header class="pe-story-maps-heading">
      <div>
        <h1 tabindex="-1" class="pe-story-map-title">{{ text.title }}</h1>
        <p class="pe:text-sm pe:text-muted">{{ text.intro }}</p>
      </div>
      <UButton
        v-if="project && !scope.mapId"
        type="button"
        icon="i-lucide-plus"
        :label="text.create"
        data-testid="story-map-create"
        data-pe-focus-key="story-map-create"
        @click="start"
      />
    </header>
    <p
      v-if="status"
      :role="status.role"
      :class="{ 'pe-story-maps-empty': status.empty }"
      :data-testid="status.empty ? 'story-maps-empty' : undefined"
    >
      {{ status.label }}
    </p>
    <ul v-else :aria-label="text.title" class="pe-story-map-list">
      <li v-for="map in rows" :key="map.id">
        <button
          type="button"
          class="pe-story-map-row"
          data-testid="story-map-row"
          :data-story-map-id="map.id"
          :data-pe-focus-key="map.id"
          @click="openMap(map.id, $event.currentTarget as HTMLElement)"
        >
          <span class="pe-story-map-row-copy">
            <strong data-testid="story-map-row-title">{{ map.title }}</strong>
            <span>{{ map.goal }}</span>
          </span>
          <span class="pe-story-map-row-meta">
            <span>{{ map.persona }}</span>
            <span data-testid="story-map-row-counts">
              {{ map.displayId }} · {{ text.storyCount(map.storyCount) }} ·
              {{ text.linkedStoryCount(map.linkedStoryCount) }}
            </span>
          </span>
          <UIcon name="i-lucide-chevron-right" aria-hidden="true" />
        </button>
      </li>
    </ul>
    <StoryMapCreateDialog v-if="creating" :project-id="projectId" @dismiss="dismiss" />
  </section>
</template>
