<script setup lang="ts">
import UButton from "@nuxt/ui/components/Button.vue";
import { computed, onMounted, ref, watch } from "vue";
import { backlogRoute, pbiDetailRoute } from "../../application/backlog";
import type { BacklogItem, BacklogSnapshot } from "../../application/backlog";
import { isCanonicalStoryItem } from "../../application/story-maps";
import type { StoryMapRecord } from "../../application/story-maps";
import type { StoryMapCard } from "../../domain/story-maps";
import { useRememberWorkspaceOrigin, useRestoreWorkspacePosition } from "../projects";
import { useMessages, useNavigate } from "../shell";
import StoryMapLinkEditor from "./StoryMapLinkEditor.vue";
import StoryMapOrderButtons from "./StoryMapOrderButtons.vue";
import StoryMapTools from "./StoryMapTools.vue";
import StoryMapWork from "./StoryMapWork.vue";

const { map, card, backlog, index, length } = defineProps<{
  readonly map: StoryMapRecord;
  readonly card: StoryMapCard;
  readonly backlog: BacklogSnapshot;
  readonly index: number;
  readonly length: number;
}>();
const emit = defineEmits<{
  edit: [origin?: HTMLElement];
  move: [offset: -1 | 1, origin?: HTMLElement];
}>();
const catalogs = useMessages();
const text = catalogs["story-maps"];
const linking = ref(false);
let linkTrigger: HTMLElement | undefined;
const links = computed(() =>
  map.cardLinks
    .filter(({ cardId }) => cardId === card.id)
    .map((reference) => ({
      reference,
      item:
        reference.projectId === map.projectId
          ? backlog.items.find(
              (item) => isCanonicalStoryItem(item) && item.id === reference.recordId,
            )
          : undefined,
    })),
);
const remember = useRememberWorkspaceOrigin();
const restore = useRestoreWorkspacePosition();
const navigate = useNavigate();
onMounted(() => restore());
watch(links, () => restore(), { flush: "post" });

function beginLink(origin: HTMLElement | undefined) {
  linkTrigger = origin;
  linking.value = true;
}

function finishLink() {
  linking.value = false;
  linkTrigger?.focus({ preventScroll: true });
}

async function openItem(item: BacklogItem, event: MouseEvent) {
  if (!item.id) return;
  remember(event.currentTarget as HTMLElement);
  const route =
    item.kind === "UC"
      ? pbiDetailRoute(map.projectId, item.id)
      : backlogRoute(map.projectId, item.id);
  if (!(await navigate(route))) remember(undefined);
}
</script>

<template>
  <article
    class="pe-story-card"
    :aria-label="card.title"
    :data-testid="'story-map-card-' + card.id"
  >
    <h4>
      <StoryMapTools
        :node="card.id"
        :label="text.journey.cardActions(card.title)"
        :title="card.title"
      >
        <template #default="{ invoke }">
          <p v-if="card.description" class="pe-story-card-description">{{ card.description }}</p>
          <UButton
            type="button"
            color="neutral"
            variant="ghost"
            :label="text.journey.edit.card"
            data-testid="story-map-card-edit"
            @click="invoke((origin) => emit('edit', origin))"
          />
          <UButton
            type="button"
            color="neutral"
            variant="ghost"
            :label="text.journey.editLinks"
            data-testid="story-map-card-link"
            @click="invoke(beginLink)"
          />
          <StoryMapOrderButtons
            :index="index"
            :length="length"
            vertical
            @move="(offset) => invoke((origin) => emit('move', offset, origin))"
          />
        </template>
      </StoryMapTools>
    </h4>
    <ul v-if="links.length" class="pe-story-card-links" :aria-label="text.journey.linkedItems">
      <li v-for="({ reference, item }, position) in links" :key="position">
        <UButton
          v-if="item"
          type="button"
          color="neutral"
          variant="link"
          :data-story-item="item.id"
          :data-pe-focus-key="'story-item-' + card.id + '-' + item.id"
          class="pe:p-0 pe:wrap-anywhere pe:whitespace-normal pe:text-start"
          @click="openItem(item, $event)"
        >
          {{ item.id }} · {{ item.title }}
        </UButton>
        <small v-if="item" class="pe:block">{{
          [catalogs.backlog.types[item.kind], item.state].filter(Boolean).join(" · ")
        }}</small>
        <span v-else>{{ reference.recordId }} · {{ text.errors.target }}</span>
      </li>
    </ul>
    <p v-else class="pe-story-card-links">{{ text.journey.unlinked }}</p>
    <StoryMapWork :map="map" :card="card" :backlog="backlog" />
    <StoryMapLinkEditor
      v-if="linking"
      :map="map"
      :card="card"
      :items="backlog.items"
      @dismiss="finishLink"
    />
  </article>
</template>
