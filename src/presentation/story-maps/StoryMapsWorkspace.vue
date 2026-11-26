<script setup lang="ts">
import UButton from "@nuxt/ui/components/Button.vue";
import { computed, nextTick, onMounted, ref, watch } from "vue";
import { backlogChanges } from "../../application/backlog";
import type { BacklogSnapshot } from "../../application/backlog";
import { projectChanges, projectSnapshot } from "../../application/projects";
import {
  storyMapRows,
  storyMapsChanges,
  storyMapsRoute,
  storyMapsSnapshot,
  storyMapSliceRoute,
} from "../../application/story-maps";
import type { StoryMapId } from "../../domain/story-maps";
import { useRememberWorkspaceOrigin, useRestoreWorkspacePosition } from "../projects";
import { useAsyncStream, useMessages, useNavigate, useStream } from "../shell";
import StoryMapCreateDialog from "./StoryMapCreateDialog.vue";
import StoryMapDetail from "./StoryMapDetail.vue";
import StoryMapsRegister from "./StoryMapsRegister.vue";
import StorySliceReview from "./StorySliceReview.vue";

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
const canCreate = computed(() => Boolean(project.value && !scope.mapId));
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

async function openSlice(id: StoryMapId, sliceId: string, event: MouseEvent) {
  remember(event.currentTarget as HTMLElement);
  if (!(await navigate(storyMapSliceRoute(projectId, id, sliceId)))) remember(undefined);
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
  <StorySliceReview
    v-if="current && scope.sliceId"
    :key="current.id + '/' + scope.sliceId"
    :map="current"
    :slice-id="scope.sliceId"
    :backlog="backlog"
  />
  <StoryMapDetail
    v-else-if="current"
    :key="current.id"
    :map="current"
    :backlog="backlog"
    :card-id="scope.cardId"
  >
    <template #slice-review="{ map, slice }">
      <UButton
        type="button"
        color="primary"
        variant="soft"
        size="xs"
        :label="text.handoff.review"
        :data-testid="'story-map-slice-review-' + slice.id"
        :data-pe-focus-key="'slice-review-' + slice.id"
        @click="openSlice(map.id, slice.id, $event)"
      />
    </template>
  </StoryMapDetail>
  <StoryMapsRegister
    v-else
    :can-create="canCreate"
    :rows="rows"
    :status="status"
    @open="openMap"
    @create="start"
  >
    <StoryMapCreateDialog v-if="creating" :project-id="projectId" @dismiss="dismiss" />
  </StoryMapsRegister>
</template>
