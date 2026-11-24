<script setup lang="ts">
import UButton from "@nuxt/ui/components/Button.vue";
import UModal from "@nuxt/ui/components/Modal.vue";
import { useForm } from "@tanstack/vue-form";
import { computed, ref, useId, useTemplateRef } from "vue";
import { requestReviewChange, reviewChangeExplanation } from "../../application/feature-requests";
import type { ReviewTarget } from "../../application/feature-requests";
import { leafModalUi } from "../projects";
import { ErrorNotice, useCommand, useMessages, useModal } from "../shell";

const { target, description } = defineProps<{
  readonly target: ReviewTarget | undefined;
  readonly description: string;
}>();
const emit = defineEmits<{ dismiss: []; closed: [saved: boolean]; refresh: [] }>();
const text = useMessages()["feature-requests"];
const open = computed(() => target !== undefined);
const input = useTemplateRef<HTMLTextAreaElement>("changeReason");
const invalid = ref(false);
const saved = ref(false);
const showError = ref(false);
const errorId = useId();
const { run: change, pending, message } = useCommand(requestReviewChange);
const form = useForm({
  defaultValues: { reason: "" },
  async onSubmit({ value }) {
    if (!target) return;
    const reason = reviewChangeExplanation(value.reason);
    invalid.value = !reason;
    if (!reason) {
      input.value?.focus();
      return;
    }
    const outcome = await change(target, reason);
    showError.value = outcome._tag === "failure";
    emit("refresh");
    if (outcome._tag === "success") dismiss(true);
  },
});
const reason = form.useStore((state) => state.values.reason);
const modal = useModal(
  open,
  () => {
    form.reset();
    invalid.value = false;
    showError.value = false;
    emit("closed", saved.value);
    saved.value = false;
  },
  cancel,
);

function dismiss(committed: boolean) {
  if (pending.value) return;
  saved.value = committed;
  emit("dismiss");
}

function cancel() {
  dismiss(false);
}
</script>

<template>
  <UModal
    :open="open"
    :title="text.review.requestChange"
    :description="description"
    :content="modal"
    :ui="{ ...leafModalUi, description: 'pe:wrap-anywhere', body: 'pe:min-w-0 pe:p-4' }"
    :dismissible="!pending"
    @update:open="
      (next) => {
        if (!next) cancel();
      }
    "
  >
    <template #body>
      <form class="pe:grid pe:min-w-0 pe:gap-3" novalidate @submit.prevent="form.handleSubmit">
        <label class="pe:grid pe:min-w-0 pe:gap-1">
          {{ text.review.changeReason }}
          <textarea
            ref="changeReason"
            name="reason"
            class="pe:w-full"
            rows="4"
            data-autofocus
            required
            :value="reason"
            :aria-invalid="invalid"
            :aria-describedby="invalid ? errorId : undefined"
            :disabled="pending"
            @input="
              invalid = false;
              form.setFieldValue('reason', ($event.target as HTMLTextAreaElement).value);
            "
          />
        </label>
        <p v-if="invalid" :id="errorId" role="alert">{{ text.errors["review-reason"] }}</p>
        <ErrorNotice v-if="showError && message" :message="message" />
        <div class="pe-note-actions">
          <UButton
            type="button"
            variant="soft"
            :disabled="pending"
            :label="text.cancel"
            @click="cancel"
          />
          <UButton
            type="submit"
            :loading="pending"
            :label="text.review.requestChange"
            data-testid="review-change-submit"
          />
        </div>
      </form>
    </template>
  </UModal>
</template>
