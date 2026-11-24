<script setup lang="ts">
import UButton from "@nuxt/ui/components/Button.vue";
import { computed, nextTick, onMounted, ref, shallowRef, watch } from "vue";
import { backlogRoute, pbiDetailRoute } from "../../application/backlog";
import type { BacklogItem, BacklogSnapshot } from "../../application/backlog";
import { knowledgeChanges, knowledgeSnapshot } from "../../application/knowledge";
import {
  pendingStorySliceCreation,
  PROJECT_STORY_MAPS,
  readStoryMapForEdit,
  setStorySliceDeferral,
  storyMapsRoute,
  storySliceStories,
} from "../../application/story-maps";
import type { StoryMapRecord } from "../../application/story-maps";
import type { StoryMapCard } from "../../domain/story-maps";
import { useRememberWorkspaceOrigin, useRestoreWorkspacePosition } from "../projects";
import {
  ErrorNotice,
  useCommand,
  useHistory,
  useMessages,
  useNavigate,
  useNavigationGuard,
  useQuery,
  useRouting,
  useStream,
} from "../shell";
import StoryMapLinkEditor from "./StoryMapLinkEditor.vue";
import StorySliceCreation from "./StorySliceCreation.vue";
import StorySliceReviewRow from "./StorySliceReviewRow.vue";

const { map, sliceId, backlog } = defineProps<{
  readonly map: StoryMapRecord;
  readonly sliceId: string;
  readonly backlog: BacklogSnapshot;
}>();
const catalogs = useMessages();
const storyText = catalogs["story-maps"];
const text = storyText.handoff;
const content = ref<HTMLElement>();
const slice = computed(() => map.slices.find(({ id }) => id === sliceId));
const title = computed(() => slice.value?.title ?? text.title);
const outcome = computed(() => slice.value?.outcome);
const emptyLabel = computed(() => (slice.value ? text.empty : text.missing));
const stories = computed(() => storySliceStories(map, sliceId, backlog.items));
const summary = computed(() => {
  if (!slice.value || !backlog.ready) return undefined;
  const covered = stories.value.filter((story) => story.covered).length;
  const deferred = stories.value.filter((story) => story.deferred).length;
  const count = text.count(covered, stories.value.length);
  return deferred ? count + " · " + text.deferredCount(deferred) : count;
});
const missingBacklog = computed(() => slice.value && backlog.ready && !backlog.base);
const hasBacklog = computed(() => Boolean(backlog.base));
const read = useQuery(readStoryMapForEdit);
const {
  pending: deciding,
  message: decisionMessage,
  run: decide,
} = useCommand(setStorySliceDeferral);
const decisionCard = ref<string>();
const draft = shallowRef<{
  readonly base: StoryMapRecord;
  readonly card: StoryMapCard;
  readonly action: "create" | "link";
}>();
const { history } = useRouting();
const { back } = useHistory();
const navigate = useNavigate();
const remember = useRememberWorkspaceOrigin();
const restore = useRestoreWorkspacePosition();
const knowledge = useStream(knowledgeSnapshot, knowledgeChanges);
const busy = computed(() => deciding.value || read.pending.value || !knowledge.value.ready);
const creating = computed(() =>
  draft.value?.action === "create" && backlog.base
    ? { ...draft.value, backlog: backlog.base }
    : undefined,
);
const linking = computed(() => (draft.value?.action === "link" ? draft.value : undefined));
onMounted(() => restore());
watch(stories, () => restore(), { flush: "post" });
useNavigationGuard(() => !deciding.value && !read.pending.value);

function goToMap() {
  const previous = history.value.back.at(-1);
  if (
    previous?.name === PROJECT_STORY_MAPS &&
    previous.projectId === map.projectId &&
    previous.mapId === map.id &&
    !previous.sliceId
  )
    return back();
  return navigate(storyMapsRoute(map.projectId, map.id));
}

function errorFor(cardId: string) {
  return decisionCard.value === cardId ? decisionMessage.value : undefined;
}

function hasDraft(cardId: string) {
  return Boolean(pendingStorySliceCreation(map, { sliceId, cardId }));
}

async function begin(cardId: string, action: "create" | "link") {
  if (busy.value) return;
  const result = await read.run(map);
  if (result._tag !== "success") return;
  const fresh = result.value;
  const story = storySliceStories(fresh, sliceId, backlog.items).find(
    ({ card }) => card.id === cardId,
  );
  if (story && !story.deferred && !story.recoverySlice && (action === "link" || !story.covered))
    draft.value = { base: fresh, card: story.card, action };
}

function focusStory(cardId: string) {
  void nextTick(() => {
    const rows = content.value?.querySelectorAll<HTMLElement>("[data-slice-story]") ?? [];
    Array.from(rows)
      .find((row) => row.dataset.sliceStory === cardId)
      ?.focus({ preventScroll: true });
  });
}

function finish() {
  const cardId = draft.value?.card.id;
  draft.value = undefined;
  if (cardId) focusStory(cardId);
}

async function setDeferred(cardId: string, deferred: boolean) {
  if (deciding.value) return;
  decisionCard.value = cardId;
  await decide(map, { sliceId, cardId }, deferred);
  focusStory(cardId);
}

async function openItem(item: BacklogItem, event: MouseEvent) {
  if (!item.id) return;
  const route =
    item.kind === "UC"
      ? pbiDetailRoute(map.projectId, item.id)
      : backlogRoute(map.projectId, item.id);
  remember(event.currentTarget as HTMLElement);
  if (!(await navigate(route))) remember(undefined);
}

async function openStory(cardId: string, event: MouseEvent) {
  const trigger = event.currentTarget as HTMLElement;
  remember(trigger.closest<HTMLElement>("[data-slice-story]") ?? trigger);
  if (!(await navigate(storyMapsRoute(map.projectId, map.id, cardId)))) remember(undefined);
}
</script>

<template>
  <article ref="content" class="pe-story-maps pe-story-slice-review" data-testid="slice-review">
    <header class="pe:grid pe:gap-1">
      <div class="pe-story-slice-path">
        <span>{{ storyText.title }} /</span>
        <UButton
          v-if="stories.length"
          type="button"
          variant="link"
          color="neutral"
          class="pe:p-0"
          :label="map.title"
          @click="goToMap"
        />
        <span v-else>{{ map.title }}</span>
        <span>/ {{ text.title }}</span>
      </div>
      <h1 tabindex="-1" class="pe-story-map-title">{{ title }}</h1>
      <p v-if="outcome" class="pe-story-goal">{{ outcome }}</p>
    </header>
    <p v-if="summary" role="status" data-testid="slice-review-count">{{ summary }}</p>
    <ErrorNotice v-if="read.message.value" :message="read.message.value" />
    <p v-if="missingBacklog" role="status">{{ text.noBacklog }}</p>
    <div v-if="stories.length" class="pe-story-slice-list">
      <StorySliceReviewRow
        v-for="story in stories"
        :key="story.card.id"
        :story="story"
        :busy="busy"
        :actionable="hasBacklog"
        :recovering="hasDraft(story.card.id)"
        :message="errorFor(story.card.id)"
        @begin="begin"
        @defer="setDeferred"
        @open="openItem"
        @open-story="openStory"
      />
    </div>
    <section v-else class="pe-story-slice-empty">
      <p>{{ emptyLabel }}</p>
      <UButton type="button" variant="soft" :label="text.emptyBack" @click="goToMap" />
    </section>
    <StorySliceCreation
      v-if="creating"
      :map="creating.base"
      :live="map"
      :slice-id="sliceId"
      :card="creating.card"
      :base="creating.backlog"
      :items="backlog.items"
      :records="knowledge.records"
      @dismiss="finish"
    />
    <StoryMapLinkEditor
      v-if="linking"
      :map="map"
      :card="linking.card"
      :items="backlog.items"
      :slice-id="sliceId"
      @dismiss="finish"
    />
  </article>
</template>
