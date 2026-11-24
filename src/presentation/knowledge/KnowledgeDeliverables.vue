<script setup lang="ts">
import UButton from "@nuxt/ui/components/Button.vue";
import { computed } from "vue";
import {
  deliverableBacklinks,
  deliverablesChanges,
  deliverablesRoute,
  deliverablesSnapshot,
} from "../../application/backlog";
import type { DeliverableRecord } from "../../application/backlog";
import { knowledgeChanges, knowledgeSnapshot } from "../../application/knowledge";
import type { KnowledgeRecord } from "../../application/knowledge";
import { useRememberWorkspaceOrigin } from "../projects";
import { useMessages, useNavigate, useStream } from "../shell";

const { note } = defineProps<{ readonly note: KnowledgeRecord }>();
const text = useMessages().backlog.deliverables;
const catalog = useStream(
  deliverablesSnapshot(note.projectId),
  deliverablesChanges(note.projectId),
);
const knowledge = useStream(knowledgeSnapshot, knowledgeChanges);
const related = computed(() =>
  deliverableBacklinks(note, catalog.value.records, knowledge.value.records),
);
const remember = useRememberWorkspaceOrigin();
const navigate = useNavigate();

async function open(record: DeliverableRecord, event: MouseEvent) {
  remember(event.currentTarget as HTMLElement);
  if (!(await navigate(deliverablesRoute(note.projectId, record.id)))) remember(undefined);
}
</script>

<template>
  <section v-if="related.length" class="pe:grid pe:min-w-0 pe:gap-2">
    <h2 class="pe:text-base pe:font-semibold">{{ text.heading }}</h2>
    <ul class="pe:grid pe:gap-1">
      <li v-for="record in related" :key="record.id">
        <UButton
          type="button"
          color="neutral"
          variant="link"
          class="pe:h-auto pe:min-h-7 pe:wrap-anywhere pe:text-start"
          data-testid="knowledge-deliverable-backlink"
          :data-pe-focus-key="'knowledge-deliverable-' + record.id"
          :label="record.displayId + ' · ' + record.values.title"
          @click="open(record, $event)"
        />
      </li>
    </ul>
  </section>
</template>
