<script setup lang="ts">
import UButton from "@nuxt/ui/components/Button.vue";
import { computed } from "vue";
import { isKnowledgeKind } from "../../../application/knowledge";
import type { KnowledgeRecord } from "../../../application/knowledge";
import { useMessages } from "../../shell";
import type { DeliverableRow } from "./register-rows";

const { row } = defineProps<{ readonly row: DeliverableRow }>();
const emit = defineEmits<{
  open: [note: KnowledgeRecord, event: MouseEvent];
  edit: [event: MouseEvent];
  create: [event: MouseEvent];
}>();
const texts = useMessages();
const text = texts.backlog.deliverables;
const templateLabel = computed(() => {
  const { template } = row;
  return template && isKnowledgeKind(template)
    ? texts.projects.templates.labels[template]
    : template;
});
const preparationLabel = computed(() => {
  if (row.record.values.pending_knowledge_id) return text.continueNote;
  if (!row.note) return text.createNote;
  return undefined;
});
const editLabel = computed(() => (row.note ? text.editLink : text.linkNote));
const linkDescription = computed(() => {
  const { note, record } = row;
  const template = templateLabel.value;
  if (note) return [note.displayId, template].filter(Boolean).join(" · ");
  if (record.values.knowledge_id) return record.values.knowledge_id + " · " + text.missingNote;
  return template ? text.plannedTemplate(template) : text.noNote;
});
const missing = computed(() =>
  !row.note && row.record.values.knowledge_id ? "deliverable-missing-note" : undefined,
);

function open(event: MouseEvent) {
  if (row.note) emit("open", row.note, event);
}
</script>

<template>
  <div class="pe-deliverable-knowledge">
    <UButton
      v-if="row.note"
      type="button"
      color="neutral"
      variant="link"
      data-testid="deliverable-open-note"
      :data-pe-focus-key="'deliverable-note-' + row.record.id"
      :label="row.note.title"
      @click="open"
    />
    <small class="pe:text-muted" :data-testid="missing">{{ linkDescription }}</small>
    <div class="pe:flex pe:flex-wrap pe:gap-x-3 pe:gap-y-1">
      <UButton
        type="button"
        color="neutral"
        variant="link"
        data-testid="deliverable-link-note"
        :data-pe-focus-key="'deliverable-link-' + row.record.id"
        :label="editLabel"
        @click="emit('edit', $event)"
      />
      <UButton
        v-if="preparationLabel"
        type="button"
        color="neutral"
        variant="link"
        data-testid="deliverable-create-note"
        :data-pe-focus-key="'deliverable-create-note-' + row.record.id"
        :label="preparationLabel"
        @click="emit('create', $event)"
      />
    </div>
  </div>
</template>
