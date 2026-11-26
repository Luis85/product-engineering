<script setup lang="ts">
import UButton from "@nuxt/ui/components/Button.vue";
import UFormField from "@nuxt/ui/components/FormField.vue";
import UInput from "@nuxt/ui/components/Input.vue";
import UModal from "@nuxt/ui/components/Modal.vue";
import { useForm } from "@tanstack/vue-form";
import { nextTick, ref } from "vue";
import {
  newProjectCriterionId,
  projectCriterionTypes,
  saveProjectCriterion,
} from "../../../application/projects";
import type {
  ProjectCriterion,
  ProjectCriterionDraft,
  ProjectGatePhase,
  ProjectId,
} from "../../../application/projects";
import { ErrorNotice, useCommand, useMessages, useModal, useService } from "../../shell";
import { leafModalUi } from "../overlay-ui";

const { criterion, phase, projectId, version, afterClose } = defineProps<{
  readonly projectId: ProjectId;
  readonly criterion: ProjectCriterion | undefined;
  readonly phase: ProjectGatePhase;
  readonly version: number;
  readonly afterClose: () => void;
}>();
const emit = defineEmits<{ dismiss: [] }>();
const messages = useMessages().projects;
const text = messages.definitions;
const id = criterion?.id ?? useService(newProjectCriterionId);
const { run, pending, message, error } = useCommand(saveProjectCriterion);
const open = ref(true);
const localError = ref<"title" | "type">();
const controls = ref<HTMLFormElement>();
const modal = useModal(open, () => {
  emit("dismiss");
  afterClose();
});
const initial: ProjectCriterionDraft = {
  title: criterion?.title ?? "",
  type: criterion?.type ?? "manual",
  enabled: criterion?.enabled ?? true,
};
const form = useForm({
  defaultValues: initial,
  async onSubmit({ value }) {
    localError.value = undefined;
    const outcome = await run(projectId, version, phase, id, value);
    if (outcome._tag === "success") open.value = false;
    if (outcome._tag !== "failure" || outcome.error._tag !== "ProjectCriterionError") return;
    const { reason } = outcome.error;
    if (reason !== "title" && reason !== "type") return;
    localError.value = reason;
    await nextTick();
    controls.value?.querySelector<HTMLElement>(`[name="${reason}"]`)?.focus();
  },
});

function dismiss() {
  if (!pending.value) open.value = false;
}
</script>

<template>
  <UModal
    :open="open"
    :title="`${text.phases[phase]} · ${criterion ? text.edit : text.add}`"
    :dismissible="!pending"
    :content="modal"
    :ui="leafModalUi"
    @update:open="dismiss"
  >
    <template #body>
      <form
        ref="controls"
        class="pe:grid pe:gap-4"
        novalidate
        @submit.prevent="form.handleSubmit()"
      >
        <form.Field v-slot="{ field }" name="title">
          <UFormField :label="text.criterion" :error="localError === 'title' && text.errors.title">
            <UInput
              name="title"
              data-autofocus
              aria-required="true"
              :readonly="pending"
              :model-value="field.state.value"
              class="pe:w-full"
              @update:model-value="
                (value) => {
                  localError = undefined;
                  field.handleChange(String(value));
                }
              "
            />
          </UFormField>
        </form.Field>
        <form.Field v-slot="{ field }" name="type">
          <label class="pe:grid pe:gap-1 pe:text-sm">
            <span class="pe:font-medium">{{ text.type }}</span>
            <select
              name="type"
              :value="field.state.value"
              :disabled="pending"
              :aria-invalid="localError === 'type'"
              class="pe:w-full pe:rounded pe:border pe:border-default pe:bg-default pe:p-2"
              @change="
                (event) => {
                  localError = undefined;
                  field.handleChange(
                    (event.target as HTMLSelectElement).value as ProjectCriterionDraft['type'],
                  );
                }
              "
            >
              <option v-for="type in projectCriterionTypes" :key="type" :value="type">
                {{ text.types[type] }}
              </option>
            </select>
            <span v-if="localError === 'type'" role="alert">{{ text.errors.type }}</span>
          </label>
        </form.Field>
        <form.Field v-slot="{ field }" name="enabled">
          <label class="pe:flex pe:items-center pe:gap-2"
            ><input
              name="enabled"
              type="checkbox"
              :checked="field.state.value"
              :disabled="pending"
              @change="field.handleChange(($event.target as HTMLInputElement).checked)"
            />{{ text.enabled }}</label
          >
        </form.Field>
        <ErrorNotice
          v-if="
            message &&
            (error?._tag !== 'ProjectCriterionError' ||
              error.reason === 'conflict' ||
              error.reason === 'unavailable')
          "
          :message="message"
        />
        <div class="pe:flex pe:flex-wrap pe:justify-end pe:gap-2">
          <UButton type="button" variant="ghost" color="neutral" @click="dismiss">{{
            messages.cancel
          }}</UButton>
          <UButton type="submit" :loading="pending" :aria-disabled="pending">{{
            text.save
          }}</UButton>
        </div>
      </form>
    </template>
  </UModal>
</template>
