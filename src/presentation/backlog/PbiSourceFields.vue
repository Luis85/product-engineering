<script setup lang="ts">
import { computed } from "vue";
import { pbiSourceFields, pbiSourceKinds } from "../../application/backlog";
import type { PbiDraft, PbiSourceKind } from "../../application/backlog";
import type { KnowledgeRecord } from "../../application/knowledge";
import { useMessages } from "../shell";

const { draft, options, saving } = defineProps<{
  readonly draft: PbiDraft;
  readonly options: readonly KnowledgeRecord[];
  readonly saving: boolean;
}>();
const emit = defineEmits<{ field: [keyof PbiDraft, string | boolean] }>();
const text = useMessages().backlog.sources;
const requirement = computed(
  () =>
    options.find(({ id, kind }) => id === draft.pbi_prd_id && kind === "prd")?.values
      .requirement_id,
);

function available(kind: PbiSourceKind) {
  return options.filter(
    (record) => record.kind === kind && (kind !== "prd" || record.values.requirement_id),
  );
}

function source(kind: PbiSourceKind, event: Event) {
  const id = (event.currentTarget as HTMLSelectElement).value;
  emit("field", pbiSourceFields[kind], id);
  if (kind === "prd") {
    emit(
      "field",
      "pbi_requirement_id",
      available(kind).find((record) => record.id === id)?.values.requirement_id ?? "",
    );
  }
}
</script>

<template>
  <fieldset :disabled="saving" class="pe-backlog-fields">
    <legend class="pe:font-semibold">{{ text.title }}</legend>
    <label v-for="kind in pbiSourceKinds" :key="kind">
      {{ text.kinds[kind] }}
      <select
        :name="pbiSourceFields[kind]"
        :value="draft[pbiSourceFields[kind]]"
        @change="source(kind, $event)"
      >
        <option value="">{{ text.choose }}</option>
        <option
          v-if="
            draft[pbiSourceFields[kind]] &&
            !available(kind).some(({ id }) => id === draft[pbiSourceFields[kind]])
          "
          :value="draft[pbiSourceFields[kind]]"
        >
          {{ draft[pbiSourceFields[kind]] }} · {{ text.missing }}
        </option>
        <option v-for="note in available(kind)" :key="note.id" :value="note.id">
          {{ note.displayId }} · {{ note.title }}
        </option>
      </select>
    </label>
    <label v-if="draft.pbi_prd_id || draft.pbi_requirement_id">
      {{ text.requirement }}
      <select
        name="pbi_requirement_id"
        :value="draft.pbi_requirement_id"
        @change="
          emit('field', 'pbi_requirement_id', ($event.currentTarget as HTMLSelectElement).value)
        "
      >
        <option value="">{{ text.choose }}</option>
        <option
          v-if="draft.pbi_requirement_id && draft.pbi_requirement_id !== requirement"
          :value="draft.pbi_requirement_id"
        >
          {{ draft.pbi_requirement_id }} · {{ text.missing }}
        </option>
        <option v-if="requirement" :value="requirement">{{ requirement }}</option>
      </select>
    </label>
    <label class="pe:flex! pe:flex-row pe:items-center">
      <input
        name="pbi-integration"
        type="checkbox"
        :checked="draft.integration"
        @change="emit('field', 'integration', ($event.currentTarget as HTMLInputElement).checked)"
      />
      {{ text.integration }}
    </label>
  </fieldset>
</template>
