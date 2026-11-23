<script setup lang="ts">
import UFormField from "@nuxt/ui/components/FormField.vue";
import UInput from "@nuxt/ui/components/Input.vue";
import { useForm } from "@tanstack/vue-form";
import { computed, watch } from "vue";
import type { KnowledgeEditFields, KnowledgeNote } from "../../application/knowledge";
import { projectChanges, projectMemberChoices, projectSnapshot } from "../../application/projects";
import { approvals } from "../../domain/knowledge";
import { useMessages, useQuery, useStream } from "../shell";
import KnowledgeSelect from "./KnowledgeSelect.vue";

const { note, saving, invalid, fields } = defineProps<{
  readonly note: KnowledgeNote;
  readonly saving: boolean;
  readonly invalid: string | undefined;
  readonly fields: KnowledgeEditFields;
}>();
const emit = defineEmits<{ change: [patch: KnowledgeEditFields] }>();
const text = useMessages().knowledge;
const members = useQuery(projectMemberChoices);
const projects = useStream(projectSnapshot, projectChanges);
watch(
  () => projects.value.projects.find(({ id }) => id === note.projectId),
  () => void members.run(note.projectId),
  { immediate: true },
);
const assignments = computed(() => {
  const choices = (members.value.value ?? []).map(({ id, name }) => ({ value: id, label: name }));
  const assigned = note.values.owner_id;
  if (assigned && !choices.some(({ value }) => value === assigned)) {
    return [...choices, { value: assigned, label: assigned }];
  }
  return choices;
});
const approvalOptions = approvals.map((value) => ({ value, label: text.approvals[value] }));

function current() {
  return {
    title: fields.title ?? note.title,
    approval: (Object.hasOwn(fields, "approval") ? fields.approval : note.values.approval) ?? "",
    owner_id: (Object.hasOwn(fields, "owner_id") ? fields.owner_id : note.values.owner_id) ?? "",
  };
}
const form = useForm({ defaultValues: current() });
const values = form.useStore((state) => state.values);
watch(
  () => note.text,
  () => form.reset(current()),
);

function updateTitle(title: string) {
  form.setFieldValue("title", title);
  emit("change", { title });
}

function updateOwner(value: string) {
  form.setFieldValue("owner_id", value);
  emit("change", { owner_id: assignments.value.find(({ value: id }) => id === value)?.value });
}

function updateApproval(value: string) {
  form.setFieldValue("approval", value);
  emit("change", { approval: approvals.find((approval) => approval === value) });
}
</script>

<template>
  <div class="pe-note-fields">
    <UFormField
      :label="text.noteTitle"
      :error="invalid === 'title' ? text.note.fieldErrors.title : false"
    >
      <UInput
        name="title"
        class="pe:w-full"
        :model-value="values.title"
        :readonly="saving"
        @update:model-value="(value) => updateTitle(String(value))"
      />
    </UFormField>
    <KnowledgeSelect
      name="owner_id"
      :label="text.owner"
      :options="assignments"
      :empty="text.unassigned"
      :disabled="saving"
      :error="invalid === 'owner_id' ? text.note.fieldErrors.owner_id : undefined"
      :model-value="values.owner_id"
      @update:model-value="updateOwner"
    />
    <KnowledgeSelect
      name="approval"
      :label="text.note.approval"
      :options="approvalOptions"
      :empty="text.note.noApproval"
      :disabled="saving"
      :error="invalid === 'approval' ? text.note.fieldErrors.approval : undefined"
      :model-value="values.approval"
      @update:model-value="updateApproval"
    />
  </div>
</template>
