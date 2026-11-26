<script setup lang="ts">
import UButton from "@nuxt/ui/components/Button.vue";
import { computed, ref, watch } from "vue";
import {
  backlogChanges,
  directNfrs,
  nfrCatalogRoute,
  nfrChanges,
  nfrSnapshot,
  nfrTargetKey,
  resolveNfrScope,
} from "../../../application/backlog";
import type { BacklogSnapshot, NfrOrigin } from "../../../application/backlog";
import type { ProjectId } from "../../../application/projects";
import { storyMapNfrContribution } from "../../../application/story-maps";
import type { NfrId, NfrTarget } from "../../../domain/backlog";
import type { StoryMapId } from "../../../domain/story-maps";
import { useRememberWorkspaceOrigin, useRestoreWorkspacePosition } from "../../projects";
import { useAsyncStream, useMessages, useNavigate, useQuery, useStream } from "../../shell";
import NfrAssignmentPicker from "./NfrAssignmentPicker.vue";
import NfrRelatedList from "./NfrRelatedList.vue";
import { nfrTargetRoute } from "./focus";

const {
  project,
  itemId = undefined,
  mapId = undefined,
  label = undefined,
  showScope = false,
} = defineProps<{
  readonly project: ProjectId;
  readonly itemId?: string | undefined;
  readonly mapId?: StoryMapId | undefined;
  readonly label?: string | undefined;
  readonly showScope?: boolean;
}>();
const text = useMessages().backlog.nfr;
const catalog = useStream(nfrSnapshot(project), nfrChanges(project));
const target: NfrTarget = mapId ? { kind: "map", id: mapId } : { kind: "item", id: itemId ?? "" };
const direct = computed(() => directNfrs(catalog.value.records, target));
const scope = useQuery((projectId: ProjectId, source: NfrTarget) =>
  resolveNfrScope(projectId, source, storyMapNfrContribution),
);
const inherited = computed(
  () =>
    scope.value.value?.filter(({ id }) => !direct.value.some((record) => record.id === id)) ?? [],
);
const picking = ref(false);
const navigate = useNavigate();
const remember = useRememberWorkspaceOrigin();
const restore = useRestoreWorkspacePosition();
let trigger: HTMLElement | undefined;

if (showScope) {
  const items = useAsyncStream<BacklogSnapshot, never>(
    { ready: false, items: [], duplicates: [] },
    backlogChanges(project),
  );
  watch([items, catalog], () => void scope.run(project, target), { immediate: true });
}
watch([direct, inherited], () => restore(), { flush: "post" });

function pick(event: MouseEvent) {
  trigger = event.currentTarget as HTMLElement;
  picking.value = true;
}

function finishPick() {
  picking.value = false;
  trigger?.focus({ preventScroll: true });
}

async function open(id: NfrId, event: MouseEvent) {
  remember(event.currentTarget as HTMLElement);
  if (!(await navigate(nfrCatalogRoute(project, id, showScope ? undefined : itemId))))
    remember(undefined);
}

async function openOrigin(origin: NfrOrigin, event: MouseEvent) {
  if (origin.kind === "nfr") return;
  const route = nfrTargetRoute(project, origin);
  if (!route) return;
  remember(event.currentTarget as HTMLElement);
  if (!(await navigate(route))) remember(undefined);
}
</script>

<template>
  <section v-if="target.id" class="pe-nfr-related" :data-nfr-source="nfrTargetKey(target)">
    <div class="pe-backlog-actions pe:justify-between">
      <h3>{{ text.heading }}</h3>
      <UButton
        type="button"
        variant="soft"
        color="neutral"
        size="xs"
        data-testid="nfr-assign"
        :data-pe-focus-key="'nfr-assign-' + target.id"
        :label="text.assign"
        @click="pick"
      />
    </div>
    <NfrRelatedList :direct="direct" :inherited="inherited" @open="open" @origin="openOrigin" />
    <NfrAssignmentPicker
      v-if="picking"
      :project="project"
      :target="target"
      :label="label"
      :records="catalog.records"
      @dismiss="finishPick"
    />
  </section>
</template>
