<script setup lang="ts">
import { computed } from "vue";
import { knowledgeKinds } from "../../../application/knowledge";
import type { KnowledgeRecord } from "../../../application/knowledge";
import type { ProjectMember } from "../../../application/projects";
import { deliverableStatuses } from "../../../domain/backlog";
import { useMessages } from "../../shell";
import { fieldError } from "./editor-draft";
import type { EditorFields, EditorIssue } from "./editor-draft";

const { draft, owners, notes, editing, linkOnOpen, issue, issueId } = defineProps<{
  readonly draft: EditorFields;
  readonly owners: readonly Pick<ProjectMember, "id" | "name">[];
  readonly notes: readonly KnowledgeRecord[];
  readonly editing: boolean;
  readonly linkOnOpen: boolean;
  readonly issue: EditorIssue | undefined;
  readonly issueId: string;
}>();
const emit = defineEmits<{ update: [field: keyof EditorFields, event: Event] }>();
const texts = useMessages();
const text = texts.backlog.deliverables;
const choices = computed(() => {
  const { template, knowledge_id: selected } = draft;
  return notes.filter((note) => note.id === selected || !template || note.kind === template);
});
const missingNote = computed(
  () => draft.knowledge_id && !notes.some((note) => note.id === draft.knowledge_id),
);
const missingOwner = computed(
  () => draft.owner_id && !owners.some((owner) => owner.id === draft.owner_id),
);
</script>

<template>
  <div class="pe-deliverable-fields">
    <label v-if="editing">
      {{ text.status }}
      <select
        name="status"
        data-testid="deliverable-edit-status"
        :value="draft.status"
        v-bind="fieldError('status', issue, issueId)"
        @change="emit('update', 'status', $event)"
      >
        <option v-for="status in deliverableStatuses" :key="status" :value="status">
          {{ text.statuses[status] }}
        </option>
      </select>
    </label>
    <label>
      {{ text.owner }}
      <select
        name="owner_id"
        data-testid="deliverable-owner"
        :value="draft.owner_id"
        v-bind="fieldError('owner_id', issue, issueId)"
        @change="emit('update', 'owner_id', $event)"
      >
        <option value="">{{ text.unassigned }}</option>
        <option v-for="owner in owners" :key="owner.id" :value="owner.id">{{ owner.name }}</option>
        <option v-if="missingOwner" :value="draft.owner_id">{{ draft.owner_id }}</option>
      </select>
    </label>
    <label>
      {{ text.due }}
      <input
        name="due"
        type="date"
        data-testid="deliverable-due"
        :value="draft.due"
        v-bind="fieldError('due', issue, issueId)"
        @input="emit('update', 'due', $event)"
      />
    </label>
    <label>
      {{ text.template }}
      <select
        name="template"
        data-testid="deliverable-template"
        :value="draft.template"
        v-bind="fieldError('template', issue, issueId)"
        @change="emit('update', 'template', $event)"
      >
        <option value="">{{ text.noTemplate }}</option>
        <option v-for="kind in knowledgeKinds" :key="kind" :value="kind">
          {{ texts.projects.templates.labels[kind] }}
        </option>
      </select>
    </label>
  </div>
  <label>
    {{ text.note }}
    <select
      name="knowledge_id"
      data-testid="deliverable-knowledge"
      :data-autofocus="linkOnOpen ? '' : undefined"
      :value="draft.knowledge_id"
      v-bind="fieldError('knowledge_id', issue, issueId)"
      @change="emit('update', 'knowledge_id', $event)"
    >
      <option value="">{{ text.noNote }}</option>
      <option v-for="note in choices" :key="note.id" :value="note.id">
        {{ note.title }} · {{ note.displayId }}
      </option>
      <option v-if="missingNote" :value="draft.knowledge_id">
        {{ draft.knowledge_id }} · {{ text.missingNote }}
      </option>
    </select>
  </label>
</template>
