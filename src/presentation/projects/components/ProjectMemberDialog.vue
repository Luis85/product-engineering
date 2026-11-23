<script setup lang="ts">
import UButton from "@nuxt/ui/components/Button.vue";
import UFormField from "@nuxt/ui/components/FormField.vue";
import UInput from "@nuxt/ui/components/Input.vue";
import UModal from "@nuxt/ui/components/Modal.vue";
import { useForm } from "@tanstack/vue-form";
import { nextTick, ref } from "vue";
import { addProjectMember, newProjectMemberId, projectRoles } from "../../../application/projects";
import type { ProjectId, ProjectMemberDraft } from "../../../application/projects";
import { ErrorNotice, useCommand, useMessages, useModal, useService } from "../../shell";
import { leafModalUi } from "../overlay-ui";

const { afterClose, projectId } = defineProps<{
  readonly projectId: ProjectId;
  readonly afterClose: () => void;
}>();
const emit = defineEmits<{ dismiss: [] }>();
const text = useMessages().projects;
const id = useService(newProjectMemberId);
const { run, pending, message, error } = useCommand(addProjectMember);
const open = ref(true);
const controls = ref<HTMLFormElement>();
const invalid = ref<"name" | "role" | "duplicate">();
const modal = useModal(open, () => {
  emit("dismiss");
  afterClose();
});

const initial: ProjectMemberDraft = { name: "", role: "product-owner" };
const form = useForm({
  defaultValues: initial,
  async onSubmit({ value }) {
    invalid.value = undefined;
    const outcome = await run(projectId, id, value);
    if (outcome._tag === "success") open.value = false;
    if (outcome._tag !== "failure" || outcome.error._tag !== "ProjectMemberError") return;
    const { reason } = outcome.error;
    if (reason === "unavailable") return;
    invalid.value = reason;
    await nextTick();
    controls.value
      ?.querySelector<HTMLElement>(`[name="${reason === "role" ? "role" : "name"}"]`)
      ?.focus();
  },
});

function dismiss() {
  if (!pending.value) open.value = false;
}
</script>

<template>
  <UModal
    :open="open"
    :title="text.team.add"
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
        <form.Field v-slot="{ field }" name="name">
          <UFormField
            :label="text.team.name"
            :error="(invalid === 'name' || invalid === 'duplicate') && text.team.errors[invalid]"
          >
            <UInput
              name="name"
              data-autofocus
              aria-required="true"
              :readonly="pending"
              :model-value="field.state.value"
              class="pe:w-full"
              @update:model-value="
                (value) => {
                  invalid = undefined;
                  field.handleChange(String(value));
                }
              "
            />
          </UFormField>
        </form.Field>
        <form.Field v-slot="{ field }" name="role">
          <label class="pe:grid pe:gap-1 pe:text-sm">
            <span class="pe:font-medium">{{ text.team.role }}</span>
            <select
              name="role"
              :value="field.state.value"
              :disabled="pending"
              :aria-invalid="invalid === 'role'"
              class="pe:w-full pe:rounded pe:border pe:border-default pe:bg-default pe:p-2"
              @change="
                (event) => {
                  invalid = undefined;
                  field.handleChange(
                    (event.target as HTMLSelectElement).value as ProjectMemberDraft['role'],
                  );
                }
              "
            >
              <option v-for="role in projectRoles" :key="role" :value="role">
                {{ text.team.roles[role] }}
              </option>
            </select>
            <span v-if="invalid === 'role'" role="alert">{{ text.team.errors.role }}</span>
          </label>
        </form.Field>
        <ErrorNotice
          v-if="message && (error?._tag !== 'ProjectMemberError' || error.reason === 'unavailable')"
          :message="message"
        />
        <div class="pe:flex pe:flex-wrap pe:justify-end pe:gap-2">
          <UButton type="button" variant="ghost" color="neutral" @click="dismiss">{{
            text.cancel
          }}</UButton>
          <UButton type="submit" :loading="pending" :aria-disabled="pending">{{
            text.team.add
          }}</UButton>
        </div>
      </form>
    </template>
  </UModal>
</template>
