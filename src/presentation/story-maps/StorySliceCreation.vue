<script setup lang="ts">
import { computed, ref } from "vue";
import type { BacklogCreateDraft, BacklogCreation, BacklogItem } from "../../application/backlog";
import type { KnowledgeRecord } from "../../application/knowledge";
import type { BacklogBase } from "../../application/projects";
import {
  createStorySlicePbi,
  isCanonicalStoryItem,
  pendingStorySliceCreation,
  storySliceFeature,
  storySliceSourceChoices,
} from "../../application/story-maps";
import type { StoryMapRecord } from "../../application/story-maps";
import type { StoryMapCard } from "../../domain/story-maps";
import { BacklogEditor } from "../backlog";
import { ErrorNotice, useCommand, useMessages } from "../shell";

const { map, live, sliceId, card, base, items, records } = defineProps<{
  readonly map: StoryMapRecord;
  readonly live: StoryMapRecord;
  readonly sliceId: string;
  readonly card: StoryMapCard;
  readonly base: BacklogBase;
  readonly items: readonly BacklogItem[];
  readonly records: readonly KnowledgeRecord[];
}>();
const emit = defineEmits<{ dismiss: [] }>();
const text = useMessages()["story-maps"].handoff;
const command = useCommand(createStorySlicePbi);
const target = { sliceId, cardId: card.id };
const before = pendingStorySliceCreation(map, target);
const pending = computed(() => pendingStorySliceCreation(live, target));
const { sources, prd, jobs } = storySliceSourceChoices(map, records);
const job = ref(before?.job ?? sources.job);
const candidates = computed(() => items.filter(isCanonicalStoryItem));
const initial = before ?? {
  title: card.title,
  body: card.description ?? "",
  parent: storySliceFeature(map, card, candidates.value),
  priority: base.priorities.includes("P2") ? "P2" : "",
  owner: "",
};

async function persist(operation: BacklogCreation, draft: BacklogCreateDraft) {
  const result = await command.run(map, target, operation, draft, { ...sources, job: job.value });
  return result._tag === "success" ? result.value : undefined;
}
</script>

<template>
  <BacklogEditor
    :project="map.projectId"
    :base="base"
    :items="candidates"
    kind="UC"
    :creation="{
      title: text.create,
      submit: text.submit,
      initial,
      frozen: !!pending,
      dirty: !pending && job !== (before?.job ?? sources.job),
      persist,
    }"
    @dismiss="emit('dismiss')"
  >
    <template #creation-fields>
      <div class="pe-story-slice-sources">
        <label>
          {{ text.prd }}
          <input
            name="prd"
            :value="
              prd ? [prd.displayId, sources.requirement, prd.title].join(' · ') : text.noSource
            "
            readonly
          />
        </label>
        <label>
          {{ text.job }}
          <select v-model="job" name="job" :disabled="command.pending.value || !!pending">
            <option value="">{{ text.noSource }}</option>
            <option v-for="record in jobs" :key="record.id" :value="record.id">
              {{ record.displayId }} · {{ record.title }}
            </option>
          </select>
        </label>
      </div>
    </template>
    <template #creation-feedback>
      <ErrorNotice v-if="command.message.value" :message="command.message.value" />
      <p v-if="pending" role="status">{{ text.pending }}</p>
    </template>
  </BacklogEditor>
</template>
