<script setup lang="ts">
import UButton from "@nuxt/ui/components/Button.vue";
import UModal from "@nuxt/ui/components/Modal.vue";
import { useForm } from "@tanstack/vue-form";
import { computed, ref, useId } from "vue";
import { newPbiCriterionIdentity, savePbiCriterion } from "../../application/backlog";
import type { BacklogEdit, PbiCriterionIdentity } from "../../application/backlog";
import type { ProjectId } from "../../application/projects";
import { completePbiCriterion, pbiCriterionDraft } from "../../domain/backlog";
import type { PbiCriterion } from "../../domain/backlog";
import { leafModalUi } from "../projects";
import { ErrorNotice, useCommand, useMessages, useModal, useQuery } from "../shell";

const { project, entry, criterion } = defineProps<{
  readonly project: ProjectId;
  readonly entry: BacklogEdit;
  readonly criterion: PbiCriterion | undefined;
}>();
const emit = defineEmits<{ dismiss: []; saved: [] }>();
const text = useMessages().backlog;
const open = ref(true);
const invalid = ref(false);
const save = useCommand(savePbiCriterion);
const generate = useQuery(() => newPbiCriterionIdentity);
const busy = computed(() => save.pending.value || generate.pending.value);
const id = useId();
let identity: PbiCriterionIdentity | undefined = criterion && {
  id: criterion.id,
  scenarioId: criterion.scenario_id,
};
const form = useForm({
  defaultValues: pbiCriterionDraft(criterion),
  async onSubmit({ value }) {
    if (!completePbiCriterion(value)) {
      invalid.value = true;
      return;
    }
    invalid.value = false;
    if (!identity) {
      const generated = await generate.run();
      if (generated._tag !== "success") return;
      identity = generated.value;
    }
    const saved = await save.run(project, entry, identity, value);
    if (saved._tag === "success") {
      open.value = false;
      emit("saved");
    }
  },
});
const draft = form.useStore((state) => state.values);
const fields = ["criterion", "scenario", "given", "when", "then_step"] as const;

function close() {
  if (!busy.value) open.value = false;
}

const modal = useModal(open, () => emit("dismiss"), close);
</script>

<template>
  <UModal
    :open="open"
    :title="criterion ? text.criteria.edit : text.criteria.add"
    :description="text.criteria.empty"
    :content="modal"
    :ui="leafModalUi"
    :dismissible="!busy"
    @update:open="close"
  >
    <template #body>
      <form :id="id" class="pe-backlog-fields" novalidate @submit.prevent="form.handleSubmit">
        <label v-for="field in fields" :key="field" class="pe:col-span-full">
          {{ text.criteria.fields[field] }}
          <input
            type="text"
            :name="field"
            :value="draft[field]"
            :data-autofocus="field === 'criterion' || undefined"
            :readonly="busy"
            required
            maxlength="400"
            @input="form.setFieldValue(field, ($event.currentTarget as HTMLInputElement).value)"
          />
        </label>
        <p
          v-if="invalid"
          class="pe:col-span-full pe:text-error"
          role="alert"
          data-testid="pbi-criterion-invalid"
        >
          {{ text.criteria.invalid }}
        </p>
        <ErrorNotice v-if="save.message.value" :message="save.message.value" />
      </form>
    </template>
    <template #footer>
      <UButton
        type="button"
        variant="ghost"
        :label="text.cancel"
        data-testid="pbi-criterion-cancel"
        :disabled="busy"
        @click="close"
      />
      <UButton
        type="submit"
        :form="id"
        :label="text.save"
        data-testid="pbi-criterion-save"
        :loading="busy"
      />
    </template>
  </UModal>
</template>
