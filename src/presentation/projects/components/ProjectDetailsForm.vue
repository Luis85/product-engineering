<script setup lang="ts">
import UButton from "@nuxt/ui/components/Button.vue";
import UFormField from "@nuxt/ui/components/FormField.vue";
import UInput from "@nuxt/ui/components/Input.vue";
import { useForm } from "@tanstack/vue-form";
import { computed, nextTick, ref, shallowRef, watch } from "vue";
import {
  projectDetailFields,
  projectDetails,
  projectDetailsIssues,
  saveProjectDetails,
} from "../../../application/projects";
import type { ProjectDetails, ProjectSettings } from "../../../application/projects";
import { ErrorNotice, useCommand, useMessages } from "../../shell";
import ProjectBacklogBase from "./ProjectBacklogBase.vue";

const { project } = defineProps<{ readonly project: ProjectSettings }>();
const text = useMessages().projects;
const { run: save, pending, message, error } = useCommand(saveProjectDetails);
const labels = { ...text, vault_folder: text.folder, backlog_base: text.base };
const controls = ref<HTMLFormElement>();
const invalid = shallowRef<readonly (keyof ProjectDetails)[]>([]);
const conflicts = shallowRef<readonly (keyof ProjectDetails)[]>([]);
let base = project;
const showError = shallowRef(false);
const saveMessage = computed(() =>
  showError.value && !conflicts.value.length ? message.value : undefined,
);

function fieldError(name: keyof ProjectDetails) {
  if (conflicts.value.includes(name)) return text.fieldConflict;
  return invalid.value.includes(name) && text.errors[name];
}

async function focusField(name: keyof ProjectDetails) {
  await nextTick();
  controls.value?.querySelector<HTMLInputElement>(`input[name="${name}"]`)?.focus();
}

const form = useForm({
  defaultValues: projectDetails(project),
  async onSubmit({ value }) {
    showError.value = false;
    conflicts.value = [];
    invalid.value = projectDetailsIssues(value, base);
    if (invalid.value[0]) return focusField(invalid.value[0]);
    const outcome = await save(base, value);
    if (outcome._tag === "success") reset(outcome.value);
    if (outcome._tag !== "failure") return;
    if (outcome.error._tag === "InvalidProjectError") {
      invalid.value = outcome.error.fields;
      if (invalid.value[0]) await focusField(invalid.value[0]);
      return;
    }
    showError.value = true;
    if (outcome.error._tag !== "NoteEditConflictError") return;
    const changed = outcome.error.conflicts;
    conflicts.value = projectDetailFields.filter((field) =>
      changed.some(({ key }) => key === field),
    );
    if (conflicts.value[0]) await focusField(conflicts.value[0]);
  },
});
const dirty = form.useStore((state) => state.isDirty);

function reset(snapshot: ProjectSettings) {
  base = snapshot;
  form.reset(projectDetails(snapshot));
  invalid.value = [];
  conflicts.value = [];
  showError.value = false;
}

watch(
  () => project,
  (fresh) => {
    if (!dirty.value && !pending.value) reset(fresh);
  },
);
</script>

<template>
  <form
    ref="controls"
    class="pe:grid pe:max-w-3xl pe:gap-4 pe:rounded-md pe:border pe:border-default pe:p-4 pe:@min-[700px]:grid-cols-2"
    novalidate
    @submit.prevent="form.handleSubmit()"
  >
    <p class="pe:text-sm pe:text-muted pe:@min-[700px]:col-span-2">{{ text.locationHint }}</p>
    <form.Field v-for="name in projectDetailFields" :key="name" v-slot="{ field }" :name="name">
      <UFormField
        :label="labels[name]"
        :error="fieldError(name)"
        :class="{ 'pe:@min-[700px]:col-span-2': name === 'name' || name === 'description' }"
      >
        <UInput
          :name="field.name"
          :model-value="field.state.value"
          :readonly="pending"
          :aria-required="name !== 'repository'"
          class="pe:w-full"
          @blur="field.handleBlur()"
          @update:model-value="(value) => field.handleChange(String(value))"
        />
      </UFormField>
    </form.Field>
    <ErrorNotice v-if="saveMessage" :message="saveMessage" class="pe:@min-[700px]:col-span-2" />
    <div class="pe:flex pe:flex-wrap pe:gap-2 pe:@min-[700px]:col-span-2">
      <UButton type="submit" :aria-disabled="pending" :loading="pending">{{
        text.saveProject
      }}</UButton>
      <UButton
        v-if="showError && error?._tag === 'NoteEditConflictError'"
        type="button"
        variant="soft"
        @click="reset(project)"
      >
        {{ text.reloadProject }}
      </UButton>
    </div>
  </form>
  <ProjectBacklogBase :project="project" />
</template>
