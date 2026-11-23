<script setup lang="ts">
import UButton from "@nuxt/ui/components/Button.vue";
import UInput from "@nuxt/ui/components/Input.vue";
import UModal from "@nuxt/ui/components/Modal.vue";
import { useForm } from "@tanstack/vue-form";
import { computed, ref, useId } from "vue";
import { gitCommitMessage } from "../../application/git";
import { leafModalUi } from "../projects";
import { useMessages, useModal } from "../shell";
import type { ArtifactGitWorkflow } from "./workflow";

const { git, restoreFocus } = defineProps<{
  readonly git: ArtifactGitWorkflow;
  readonly restoreFocus: () => void;
}>();
const emit = defineEmits<{ committed: []; review: [] }>();
const { review, committing, commitError } = git;
const open = computed(() => review.value !== undefined);
const modal = useModal(open, restoreFocus);
const text = useMessages().git;
const invalid = ref(false);
const errorId = useId();
const form = useForm({
  defaultValues: { message: "" },
  async onSubmit({ value }) {
    const message = gitCommitMessage(value.message);
    invalid.value = message === undefined;
    if (message && (await git.submitCommit(message))) {
      form.reset();
      emit("committed");
    }
  },
});
const message = form.useStore((state) => state.values.message);

function cancel() {
  if (committing.value) return;
  git.cancelCommit();
  form.reset();
  invalid.value = false;
}

function reReview() {
  git.cancelCommit();
  emit("review");
}
</script>

<template>
  <UModal
    :open="open"
    :title="text.commit"
    :description="review?.current.path ?? ''"
    :content="modal"
    :ui="{ ...leafModalUi, description: 'pe:wrap-anywhere' }"
    :dismissible="!committing"
    @update:open="
      (next) => {
        if (!next) cancel();
      }
    "
  >
    <template #body>
      <form
        class="pe:grid pe:min-w-0 pe:gap-3"
        data-testid="git-commit-form"
        novalidate
        @submit.prevent="form.handleSubmit"
      >
        <label class="pe:grid pe:min-w-0 pe:gap-1">
          {{ text.message }}
          <UInput
            name="message"
            data-autofocus
            :model-value="message"
            :aria-invalid="invalid"
            :aria-describedby="invalid ? errorId : undefined"
            :disabled="committing"
            @update:model-value="
              (value) => {
                invalid = false;
                form.setFieldValue('message', String(value));
              }
            "
          />
        </label>
        <p v-if="invalid" :id="errorId" role="alert">{{ text.errors.message }}</p>
        <p v-if="commitError" role="alert" data-testid="git-commit-error">
          {{ commitError.title }}
        </p>
        <div class="pe-note-actions">
          <UButton
            type="button"
            variant="soft"
            :disabled="committing"
            :label="text.cancel"
            @click="cancel"
          />
          <UButton
            v-if="commitError?.conflict"
            type="button"
            data-testid="git-review-current"
            :label="text.refresh"
            @click="reReview"
          />
          <UButton v-else type="submit" :loading="committing" :label="text.confirm" />
        </div>
      </form>
    </template>
  </UModal>
</template>
