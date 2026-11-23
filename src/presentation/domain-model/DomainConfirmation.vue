<script setup lang="ts">
import UButton from "@nuxt/ui/components/Button.vue";
import UModal from "@nuxt/ui/components/Modal.vue";
import { ref } from "vue";
import { leafModalUi } from "../projects";
import { ErrorNotice, useMessages, useModal } from "../shell";
import type { UserMessage } from "../../application/shell";

const { pending } = defineProps<{
  readonly title: string;
  readonly question: string;
  readonly action: string;
  readonly pending: boolean;
  readonly error: UserMessage | undefined;
}>();
const emit = defineEmits<{ dismiss: []; confirm: [] }>();
const open = ref(true);
const modal = useModal(open, () => emit("dismiss"));
const cancel = useMessages().knowledge.cancel;
function dismiss() {
  if (!pending) open.value = false;
}
</script>

<template>
  <UModal
    :open="open"
    :title="title"
    :description="question"
    :content="modal"
    :ui="leafModalUi"
    :dismissible="!pending"
    @update:open="dismiss"
  >
    <template #body>
      <ErrorNotice v-if="error" :message="error" />
      <div class="pe:flex pe:flex-wrap pe:justify-end pe:gap-2">
        <UButton
          type="button"
          color="neutral"
          variant="ghost"
          data-autofocus
          :disabled="pending"
          @click="dismiss"
          >{{ cancel }}</UButton
        >
        <UButton
          type="button"
          color="error"
          data-testid="domain-confirm"
          :loading="pending"
          @click="emit('confirm')"
          >{{ action }}</UButton
        >
      </div>
    </template>
  </UModal>
</template>
