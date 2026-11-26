<script setup lang="ts">
import UButton from "@nuxt/ui/components/Button.vue";
import { useForm } from "@tanstack/vue-form";
import { watch } from "vue";
import {
  projectDataClasses,
  projectIntegrationPolicy,
  setProjectDataClass,
} from "../../../application/projects";
import type { ProjectDataClass, ProjectSettings } from "../../../application/projects";
import { ErrorNotice, useCommand, useMessages } from "../../shell";

const { project } = defineProps<{ readonly project: ProjectSettings }>();
const messages = useMessages().projects;
const text = messages.integrations;
const classification = useCommand(setProjectDataClass);
let classBase = project;
const defaults = (): { dataClass: ProjectDataClass | "" } => ({
  dataClass: projectIntegrationPolicy(project).dataClass ?? "",
});
const form = useForm({
  defaultValues: defaults(),
  async onSubmit({ value }) {
    if (!value.dataClass) return;
    const outcome = await classification.run(classBase, value.dataClass);
    if (outcome._tag === "success") resetClass(outcome.value);
  },
});
const dirty = form.useStore((state) => state.isDirty);
function resetClass(snapshot: ProjectSettings) {
  classBase = snapshot;
  form.reset({ dataClass: projectIntegrationPolicy(snapshot).dataClass ?? "" });
}
watch(
  () => project,
  (fresh) => {
    if (!dirty.value && !classification.pending.value) resetClass(fresh);
  },
);
</script>

<template>
  <form
    class="pe:grid pe:max-w-3xl pe:justify-items-start pe:gap-3 pe:rounded-md pe:border pe:border-default pe:p-4"
    @submit.prevent="form.handleSubmit()"
  >
    <form.Field v-slot="{ field }" name="dataClass">
      <label class="pe:grid pe:gap-1 pe:text-sm pe:font-semibold">
        {{ text.classify }}
        <select
          name="data_class"
          :value="field.state.value"
          :disabled="classification.pending.value"
          class="pe:rounded pe:border pe:border-default pe:bg-default pe:p-2"
          @change="
            field.handleChange(($event.target as HTMLSelectElement).value as ProjectDataClass)
          "
        >
          <option value="" disabled>{{ text.errors.data_class }}</option>
          <option v-for="value in projectDataClasses" :key="value" :value="value">
            {{ text.classes[value] }}
          </option>
        </select>
      </label>
    </form.Field>
    <ErrorNotice v-if="classification.message.value" :message="classification.message.value" />
    <UButton
      v-if="dirty && classification.error.value?._tag === 'NoteEditConflictError'"
      type="button"
      variant="soft"
      @click="resetClass(project)"
      >{{ messages.reloadProject }}</UButton
    >
    <UButton
      type="submit"
      :disabled="classification.pending.value"
      :loading="classification.pending.value"
      >{{ text.saveClass }}</UButton
    >
  </form>
</template>
