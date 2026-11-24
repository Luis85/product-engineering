<script setup lang="ts">
import UButton from "@nuxt/ui/components/Button.vue";
import { computed, onMounted, watch } from "vue";
import {
  knowledgeChanges,
  knowledgeDetailRoute,
  knowledgeSnapshot,
} from "../../application/knowledge";
import { openNote } from "../../application/notes";
import { PROJECT_STORY_MAPS, storyMapsRoute } from "../../application/story-maps";
import type { StoryMapRecord } from "../../application/story-maps";
import { useRememberWorkspaceOrigin, useRestoreWorkspacePosition } from "../projects";
import {
  ErrorNotice,
  useCommand,
  useHistory,
  useMessages,
  useNavigate,
  useRouting,
  useStream,
} from "../shell";

const { map } = defineProps<{ readonly map: StoryMapRecord }>();
const text = useMessages()["story-maps"];
const navigate = useNavigate();
const { history } = useRouting();
const { back } = useHistory();
const open = useCommand(openNote);
const known = useStream(knowledgeSnapshot, knowledgeChanges);
const sourcePrd = computed(() =>
  known.value.records.find(
    ({ id, kind, projectId }) => kind === "prd" && id === map.prdId && projectId === map.projectId,
  ),
);
const rememberOrigin = useRememberWorkspaceOrigin();
const restore = useRestoreWorkspacePosition();
onMounted(() => restore());
watch(known, () => restore(), { flush: "post" });

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

function goToSource(event: Event) {
  const source = sourcePrd.value;
  if (!source) return;
  rememberOrigin(event.currentTarget as HTMLElement);
  return navigate(
    knowledgeDetailRoute(map.projectId, source.id, {
      section: "storymaps",
      reference: { kind: "story-map", recordId: map.id },
    }),
  );
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
    <header class="pe:grid pe:min-w-0 pe:gap-1">
      <h1 tabindex="-1" class="pe-story-map-title">{{ map.title }}</h1>
      <p class="pe:text-sm pe:text-muted">
        {{ map.displayId }} · {{ text.storyCount(map.cards.length) }}
      </p>
    </header>
    <dl class="pe-story-map-details">
      <div>
        <dt>{{ text.fields.persona }}</dt>
        <dd>{{ map.persona }}</dd>
      </div>
      <div>
        <dt>{{ text.fields.goal }}</dt>
        <dd>{{ map.goal }}</dd>
      </div>
      <div v-if="map.prdId && known.ready">
        <dt>{{ text.source }}</dt>
        <dd>
          <UButton
            v-if="sourcePrd"
            type="button"
            variant="link"
            class="pe:wrap-anywhere pe:text-start"
            data-testid="story-map-source-prd"
            data-pe-focus-key="story-map-source-prd"
            @click="goToSource"
            >{{ sourcePrd.displayId }} · {{ sourcePrd.title }}</UButton
          >
          <span v-else>{{ text.errors.source }}</span>
        </dd>
      </div>
    </dl>
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
  </article>
</template>
