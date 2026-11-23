<script setup lang="ts">
import UButton from "@nuxt/ui/components/Button.vue";
import UFormField from "@nuxt/ui/components/FormField.vue";
import UInput from "@nuxt/ui/components/Input.vue";
import UModal from "@nuxt/ui/components/Modal.vue";
import { useForm } from "@tanstack/vue-form";
import { nextTick, ref, shallowRef } from "vue";
import { createProject, newProjectId, projectDraftIssues } from "../../../application/projects";
import type { Project, ProjectDraft } from "../../../application/projects";
import { ErrorNotice, useCommand, useMessages, useModal, useService } from "../../shell";
import { leafModalUi } from "../overlay-ui";

const emit = defineEmits<{ dismiss: []; created: [project: Project] }>();
const text = useMessages().projects;
const id = useService(newProjectId);
const command = useCommand(createProject);
const { message, pending } = command;
const open = ref(true);
const controls = ref<HTMLFormElement>();
const invalid = shallowRef<readonly (keyof ProjectDraft)[]>([]);
const fields = ["name", "description", "repository"] as const;
const form = useForm({
  defaultValues: { name: "", description: "", repository: "" },
  async onSubmit({ value }) {
    invalid.value = projectDraftIssues(value);
    const first = invalid.value[0];
    if (first) {
      await nextTick();
      controls.value?.querySelector<HTMLInputElement>(`input[name="${first}"]`)?.focus();
      return;
    }
    const result = await command.run(id, value);
    if (result._tag === "success") emit("created", result.value);
  },
});

function dismiss() {
  if (!pending.value) emit("dismiss");
}

function submit() {
  if (!pending.value) return form.handleSubmit();
}

const modal = useModal(open, () => undefined);
</script>

<template>
  <UModal
    :open="open"
    :title="text.createTitle"
    :dismissible="!pending"
    :content="modal"
    :ui="leafModalUi"
    @update:open="dismiss"
  >
    <template #body>
      <form ref="controls" class="pe:grid pe:gap-4" novalidate @submit.prevent="submit">
        <form.Field v-for="name in fields" :key="name" v-slot="{ field }" :name="name">
          <UFormField :label="text[name]" :error="invalid.includes(name) && text.errors[name]">
            <UInput
              :name="field.name"
              :model-value="field.state.value"
              :placeholder="name === 'repository' ? 'organisation/repository' : ''"
              :data-autofocus="name === 'name' ? '' : undefined"
              :readonly="pending"
              aria-required="true"
              class="pe:w-full"
              @blur="field.handleBlur()"
              @update:model-value="(value) => field.handleChange(String(value))"
            />
          </UFormField>
        </form.Field>
        <ErrorNotice v-if="message" :message="message" />
        <div class="pe:flex pe:flex-wrap pe:justify-end pe:gap-2">
          <UButton
            type="button"
            variant="ghost"
            color="neutral"
            :aria-disabled="pending"
            @click="dismiss"
          >
            {{ text.cancel }}
          </UButton>
          <UButton type="submit" :aria-disabled="pending" :loading="pending">{{
            text.create
          }}</UButton>
        </div>
      </form>
    </template>
  </UModal>
</template>
