<script setup lang="ts">
import UButton from "@nuxt/ui/components/Button.vue";
import UModal from "@nuxt/ui/components/Modal.vue";
import { useForm } from "@tanstack/vue-form";
import { computed, ref, useId } from "vue";
import { directNfrs, setTargetNfrs } from "../../../application/backlog";
import type { NfrRecord } from "../../../application/backlog";
import type { ProjectId } from "../../../application/projects";
import type { NfrId, NfrTarget } from "../../../domain/backlog";
import { leafModalUi } from "../../projects";
import { ErrorNotice, useCommand, useMessages, useModal, useNavigationGuard } from "../../shell";

const { project, target, records } = defineProps<{
  readonly project: ProjectId;
  readonly target: NfrTarget;
  readonly records: readonly NfrRecord[];
}>();
const emit = defineEmits<{ dismiss: [] }>();
const texts = useMessages().backlog;
const text = texts.nfr;
const open = ref(true);
const formId = useId();
const {
  pending,
  message,
  run: save,
} = useCommand((scope: ProjectId, assignment: NfrTarget, ids: readonly NfrId[]) =>
  setTargetNfrs(scope, assignment, ids),
);
const modal = useModal(open, () => emit("dismiss"), close);
const form = useForm({
  defaultValues: { selected: directNfrs(records, target).map(({ id }) => id) },
  async onSubmit({ value }) {
    const result = await save(project, target, value.selected);
    if (result._tag === "success") close();
  },
});
const selected = form.useStore((state) => state.values.selected);
const missing = computed(() =>
  selected.value.filter((id) => !records.some((record) => record.id === id)),
);
useNavigationGuard(() => !pending.value);

function toggle(id: NfrId, event: Event) {
  const checked = (event.currentTarget as HTMLInputElement).checked;
  form.setFieldValue(
    "selected",
    checked ? [...selected.value, id] : selected.value.filter((entry) => entry !== id),
  );
}

function close() {
  if (!pending.value) open.value = false;
}
</script>

<template>
  <UModal
    :open="open"
    :title="text.assign"
    :description="target.id"
    :content="modal"
    :dismissible="!pending"
    :close="false"
    :ui="{ ...leafModalUi, content: leafModalUi.content + ' pe-nfr-modal' }"
    @update:open="close"
  >
    <template #body>
      <form :id="formId" data-testid="nfr-assignment-picker" @submit.prevent="form.handleSubmit">
        <fieldset v-if="records.length || missing.length" class="pe-nfr-fieldset">
          <legend>{{ text.chooseNfrs }}</legend>
          <div class="pe-nfr-checklist pe-nfr-picker-list">
            <label v-for="(record, index) in records" :key="record.id">
              <input
                type="checkbox"
                :value="record.id"
                :checked="selected.includes(record.id)"
                :data-autofocus="index === 0 || undefined"
                @change="toggle(record.id, $event)"
              />
              <span>
                <strong>{{ record.title }}</strong>
                <small class="pe-nfr-id">{{ record.id }}</small>
                <span>{{ record.requirement }}</span>
                <span class="pe:text-muted">{{ text.acceptance }} · {{ record.acceptance }}</span>
              </span>
            </label>
            <label v-for="recordId in missing" :key="recordId">
              <input type="checkbox" :value="recordId" checked @change="toggle(recordId, $event)" />
              <span>{{ recordId }} · {{ text.targetMissing }}</span>
            </label>
          </div>
        </fieldset>
        <p v-else>{{ text.blank }}</p>
        <ErrorNotice v-if="message" :message="message" />
      </form>
    </template>
    <template #footer>
      <UButton
        type="button"
        variant="ghost"
        color="neutral"
        data-testid="nfr-assign-cancel"
        :label="texts.cancel"
        :disabled="pending"
        @click="close"
      />
      <UButton
        v-if="records.length || missing.length"
        type="submit"
        :form="formId"
        data-testid="nfr-assign-save"
        :label="text.saveAssignments"
        :loading="pending"
      />
    </template>
  </UModal>
</template>
