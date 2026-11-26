<script setup lang="ts">
import UButton from "@nuxt/ui/components/Button.vue";
import { computed, shallowRef } from "vue";
import type { BacklogSnapshot } from "../../application/backlog";
import { directNfrs, nfrChanges, nfrSnapshot } from "../../application/backlog";
import { entityAssigned } from "../../application/domain-model";
import { knowledgeChanges, knowledgeSnapshot, projectKnowledge } from "../../application/knowledge";
import { openNote } from "../../application/notes";
import {
  prototypesChanges,
  prototypesForSource,
  prototypesSnapshot,
} from "../../application/prototypes";
import {
  PROJECT_STORY_MAPS,
  readStoryMapForEdit,
  storyMapsRoute,
} from "../../application/story-maps";
import type { StoryMapRecord } from "../../application/story-maps";
import type { StoryMapSlice } from "../../domain/story-maps";
import { NfrSourceLinks } from "../backlog";
import { useWorkspaceOriginKey } from "../projects";
import { PrototypeSourceLinks } from "../prototypes";
import {
  ErrorNotice,
  useCommand,
  useHistory,
  useMessages,
  useNavigate,
  useQuery,
  useRouting,
  useStream,
} from "../shell";
import StoryMapJourney from "./StoryMapJourney.vue";
import StoryMapContext from "./StoryMapContext.vue";
import StoryMapCreateDialog from "./StoryMapCreateDialog.vue";
import StoryMapEntityScope from "./StoryMapEntityScope.vue";
import StoryMapFoundations from "./StoryMapFoundations.vue";

const {
  map,
  backlog,
  cardId = undefined,
} = defineProps<{
  readonly map: StoryMapRecord;
  readonly backlog: BacklogSnapshot;
  readonly cardId?: string | undefined;
}>();
defineSlots<{
  "slice-review"?: (scope: {
    readonly map: StoryMapRecord;
    readonly slice: StoryMapSlice;
  }) => unknown;
}>();
const text = useMessages()["story-maps"];
const editing = shallowRef<StoryMapRecord>();
const read = useQuery(readStoryMapForEdit);
let editButton: HTMLElement | undefined;
const navigate = useNavigate();
const { history } = useRouting();
const { back } = useHistory();
const open = useCommand(openNote);
const known = useStream(knowledgeSnapshot, knowledgeChanges);
const records = computed(() => projectKnowledge(map.projectId, known.value.records));
const nfrs = useStream(nfrSnapshot(map.projectId), nfrChanges(map.projectId));
const scope = { kind: "map" as const, id: map.id };
const prototypeScope = { ...scope, projectId: map.projectId };
const prototypes = useStream(prototypesSnapshot(map.projectId), prototypesChanges(map.projectId));
const counts = computed(() => ({
  foundations: Number(Boolean(map.prdId)) + map.jobIds.length + map.references.length,
  prototypes: prototypesForSource(prototypes.value.records, prototypeScope).length,
  nfrs: directNfrs(nfrs.value.records, scope).length,
  entities: records.value.filter((note) => note.kind === "entity" && entityAssigned(note, scope))
    .length,
}));
const previousFocus = useWorkspaceOriginKey();
const key = previousFocus() ?? "";
const initial = key.startsWith("story-map-foundations-")
  ? "foundations"
  : key.startsWith("prototype-")
    ? "prototypes"
    : key.startsWith("nfr-")
      ? "nfrs"
      : key.startsWith("domain-link-") || key.startsWith("story-entity-")
        ? "entities"
        : undefined;

function goToMaps() {
  const previous = history.value.back.at(-1);
  if (
    previous?.name === PROJECT_STORY_MAPS &&
    previous.projectId === map.projectId &&
    !previous.mapId
  )
    return back();
  return navigate(storyMapsRoute(map.projectId));
}

async function startEdit(event: MouseEvent) {
  editButton = event.currentTarget as HTMLElement;
  const result = await read.run(map);
  if (result._tag === "success") editing.value = result.value;
}

function finishEdit() {
  editing.value = undefined;
  editButton?.focus({ preventScroll: true });
}
</script>

<template>
  <article class="pe-story-maps" data-testid="story-map-detail" :data-story-map-id="map.id">
    <UButton
      type="button"
      variant="link"
      color="neutral"
      icon="i-lucide-arrow-left"
      class="pe:justify-self-start"
      :label="text.backToMaps"
      @click="goToMaps"
    />
    <header class="pe-story-map-header">
      <div class="pe:grid pe:min-w-0 pe:gap-1">
        <p class="pe:text-xs pe:text-muted">{{ map.displayId }}</p>
        <h1 tabindex="-1" class="pe-story-map-title">{{ map.title }}</h1>
        <p class="pe-story-goal">{{ map.goal }}</p>
        <p class="pe-story-persona">
          <span>{{ text.fields.persona }}</span> <strong>{{ map.persona }}</strong>
        </p>
      </div>
      <UButton
        type="button"
        color="neutral"
        variant="soft"
        :label="text.edit"
        :loading="read.pending.value"
        data-testid="story-map-edit"
        @click="startEdit"
      />
    </header>
    <ErrorNotice v-if="read.message.value" :message="read.message.value" />
    <StoryMapContext :initial="initial" :counts="counts">
      <template #foundations><StoryMapFoundations :map="map" :records="records" /></template>
      <template #prototypes
        ><PrototypeSourceLinks
          :source="prototypeScope"
          :display-id="map.displayId"
          :empty="text.context.noPrototypes"
      /></template>
      <template #nfrs
        ><NfrSourceLinks :project="map.projectId" :map-id="map.id" :label="map.title" show-scope
      /></template>
      <template #entities
        ><StoryMapEntityScope :map="map" :records="records" :backlog="backlog"
      /></template>
    </StoryMapContext>
    <StoryMapJourney :map="map" :backlog="backlog" :card-id="cardId">
      <template #slice-review="{ slice }"
        ><slot name="slice-review" :map="map" :slice="slice"
      /></template>
    </StoryMapJourney>
    <UButton
      type="button"
      variant="soft"
      class="pe:justify-self-start"
      :label="text.openNote"
      :loading="open.pending.value"
      data-testid="story-map-open-note"
      @click="open.run(map.path)"
    />
    <ErrorNotice v-if="open.message.value" :message="open.message.value" />
    <StoryMapCreateDialog
      v-if="editing"
      :project-id="map.projectId"
      :base="editing"
      @dismiss="finishEdit"
    />
  </article>
</template>
