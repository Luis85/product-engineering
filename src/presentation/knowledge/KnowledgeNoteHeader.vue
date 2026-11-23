<script setup lang="ts">
import UButton from "@nuxt/ui/components/Button.vue";
import { computed } from "vue";
import type { KnowledgeNote } from "../../application/knowledge";
import { projectChanges, projectMembers, projectSnapshot } from "../../application/projects";
import { useMessages, useStream } from "../shell";
import KnowledgeNoteActions from "./KnowledgeNoteActions.vue";

const { title, note, gitStatus } = defineProps<{
  readonly gitStatus: string;
  readonly title: string;
  readonly note: KnowledgeNote | undefined;
}>();
const emit = defineEmits<{ edit: []; history: [] }>();
const text = useMessages().knowledge;
const projects = useStream(projectSnapshot, projectChanges);
const approval = computed(() =>
  note?.values.approval ? text.approvals[note.values.approval] : text.note.noApproval,
);
const assignment = computed(() => {
  const owner = note?.values.owner_id;
  if (!owner) return text.unassigned;
  const project = projects.value.projects.find(({ id }) => id === note?.projectId);
  return (project && projectMembers(project)?.find(({ id }) => id === owner)?.name) ?? owner;
});
</script>

<template>
  <header class="pe:grid pe:min-w-0 pe:gap-2" data-testid="knowledge-note-header">
    <div class="pe-note-heading">
      <h1 tabindex="-1" class="pe-note-title">
        {{ title }}
      </h1>
      <div v-if="note" class="pe-note-heading-actions">
        <UButton
          v-if="note.editable"
          type="button"
          data-testid="knowledge-edit"
          @click="emit('edit')"
          :label="text.note.edit"
        />
        <KnowledgeNoteActions :note="note" />
      </div>
    </div>
    <div v-if="note" class="pe-note-meta">
      <span>{{ note.displayId }}</span>
      <span v-if="note.values.requirement_id">{{ note.values.requirement_id }}</span>
      <span>{{ text.owner }} · {{ assignment }}</span>
      <span>{{ text.note.approval }} · {{ approval }}</span>
      <UButton
        type="button"
        variant="link"
        color="neutral"
        :aria-label="text.note.history"
        class="pe:min-w-0 pe:p-0"
        @click="emit('history')"
        :label="gitStatus"
      />
    </div>
  </header>
</template>
