<script setup lang="ts">
import { prepareDeliverableNote } from "../../../application/backlog";
import type { DeliverableRecord } from "../../../application/backlog";
import { isKnowledgeKind } from "../../../application/knowledge";
import type {
  CreateKnowledgeRequest,
  KnowledgeDraft,
  KnowledgeRecord,
} from "../../../application/knowledge";
import type { Note } from "../../../application/notes";
import { KnowledgeCreateDialog, useKnowledgeDraftNavigation } from "../../knowledge";

const {
  record,
  pendingNote = undefined,
  trigger,
} = defineProps<{
  readonly record: DeliverableRecord;
  readonly pendingNote?: KnowledgeRecord | undefined;
  readonly trigger: HTMLElement;
}>();
const emit = defineEmits<{ dismiss: [] }>();
const { openDraft } = useKnowledgeDraftNavigation();
const origin = { kind: "deliverable", projectId: record.projectId, recordId: record.id } as const;
const source = {
  section: "deliverables",
  reference: { kind: origin.kind, recordId: origin.recordId },
};
const template = record.values.template ?? pendingNote?.kind ?? "prd";
const initialTemplate = isKnowledgeKind(template) ? template : "prd";

function prepare(request: CreateKnowledgeRequest, draft: KnowledgeDraft) {
  return prepareDeliverableNote(record, request, draft);
}

async function created(note: Note) {
  emit("dismiss");
  await openDraft(note, record.projectId, source, trigger);
}

function cancel() {
  emit("dismiss");
  trigger.focus({ preventScroll: true });
}
</script>

<template>
  <KnowledgeCreateDialog
    :project-id="record.projectId"
    :initial-template="initialTemplate"
    :initial-title="pendingNote?.title"
    :origin="origin"
    :origin-title="record.displayId + ' · ' + record.values.title"
    :lock-template="Boolean(record.values.template || pendingNote)"
    :prepare="prepare"
    :on-created="created"
    @dismiss="cancel"
  />
</template>
