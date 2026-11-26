<script setup lang="ts">
import UButton from "@nuxt/ui/components/Button.vue";
import { computed, onMounted, shallowRef, watch } from "vue";
import { knowledgeDetailRoute } from "../../application/knowledge";
import type { KnowledgeRecord } from "../../application/knowledge";
import { readStoryMapForEdit } from "../../application/story-maps";
import type { StoryMapRecord } from "../../application/story-maps";
import { KnowledgeReferences } from "../knowledge";
import { useRememberWorkspaceOrigin, useRestoreWorkspacePosition } from "../projects";
import { ErrorNotice, useMessages, useNavigate, useQuery } from "../shell";
import StoryMapFoundationEditor from "./StoryMapFoundationEditor.vue";

const { map, records } = defineProps<{
  readonly map: StoryMapRecord;
  readonly records: readonly KnowledgeRecord[];
}>();
const text = useMessages()["story-maps"];
const editing = shallowRef<StoryMapRecord>();
const read = useQuery(readStoryMapForEdit);
const navigate = useNavigate();
const remember = useRememberWorkspaceOrigin();
const restore = useRestoreWorkspacePosition();
let trigger: HTMLElement | undefined;

const foundations = computed(() =>
  [
    ...(map.prdId ? [{ id: map.prdId, kind: "prd" as const }] : []),
    ...map.jobIds.map((id) => ({ id, kind: "jtbd" as const })),
  ].map((entry) => ({
    ...entry,
    testId: entry.kind === "prd" ? "story-map-source-prd" : "story-map-source-job",
    missing: entry.kind === "prd" ? text.errors.source : text.errors.target,
    record: records.find(({ id, kind }) => id === entry.id && kind === entry.kind),
  })),
);
const empty = computed(() => !foundations.value.length && !map.references.length);

onMounted(() => restore());
watch(foundations, () => restore(), { flush: "post" });

async function start(event: MouseEvent) {
  trigger = event.currentTarget as HTMLElement;
  const result = await read.run(map);
  if (result._tag === "success") editing.value = result.value;
}

function dismiss() {
  editing.value = undefined;
  trigger?.focus({ preventScroll: true });
}

function open(record: KnowledgeRecord, event: MouseEvent) {
  remember(event.currentTarget as HTMLElement);
  return navigate(
    knowledgeDetailRoute(map.projectId, record.id, {
      section: "storymaps",
      reference: { kind: "story-map", recordId: map.id },
    }),
  );
}
</script>

<template>
  <div class="pe:grid pe:min-w-0 pe:gap-2">
    <ul v-if="foundations.length" class="pe:grid pe:min-w-0 pe:gap-1">
      <li v-for="entry in foundations" :key="entry.id">
        <UButton
          v-if="entry.record"
          type="button"
          variant="link"
          class="pe:wrap-anywhere pe:text-start"
          :data-testid="entry.testId"
          :data-pe-focus-key="'story-map-foundations-' + entry.id"
          @click="open(entry.record, $event)"
          >{{ entry.record.displayId }} · {{ entry.record.title }}</UButton
        >
        <span v-else>{{ entry.id }} · {{ entry.missing }}</span>
      </li>
    </ul>
    <p v-if="empty">{{ text.foundation.unassigned }}</p>
    <KnowledgeReferences
      v-if="map.references.length"
      :source="map.path"
      :references="map.references"
      :editable="false"
      explicit-only
    />
    <UButton
      type="button"
      color="neutral"
      variant="soft"
      class="pe:justify-self-start"
      :label="text.foundation.edit"
      :loading="read.pending.value"
      data-testid="story-map-foundation-edit"
      @click="start"
    />
    <ErrorNotice v-if="read.message.value" :message="read.message.value" />
    <StoryMapFoundationEditor v-if="editing" :map="editing" :records="records" @dismiss="dismiss" />
  </div>
</template>
