<script setup lang="ts">
import UButton from "@nuxt/ui/components/Button.vue";
import UModal from "@nuxt/ui/components/Modal.vue";
import { leafModalUi } from "../projects";
import { useMessages, useModal } from "../shell";

const {
  saving,
  restoreFocus,
  localEscape = false,
} = defineProps<{
  readonly saving: boolean;
  readonly restoreFocus: () => void;
  readonly localEscape?: boolean;
}>();
const open = defineModel<boolean>("open", { required: true });
const emit = defineEmits<{ keep: []; discard: []; save: [] }>();
const text = useMessages().knowledge.note;
function keepEditing() {
  if (!saving) emit("keep");
}
const modal = useModal(open, restoreFocus, localEscape ? keepEditing : undefined);
</script>

<template>
  <UModal
    :open="open"
    :title="text.dirty"
    :description="text.leaveQuestion"
    :content="modal"
    :ui="leafModalUi"
    :dismissible="!saving"
    @update:open="emit('keep')"
  >
    <template #body>
      <div class="pe-note-actions">
        <UButton
          type="button"
          variant="soft"
          data-autofocus
          data-testid="knowledge-keep-editing"
          :disabled="saving"
          @click="emit('keep')"
          :label="text.keep"
        />
        <UButton
          type="button"
          color="error"
          variant="soft"
          data-testid="knowledge-discard-leave"
          :disabled="saving"
          @click="emit('discard')"
          :label="text.discard"
        />
        <UButton
          type="button"
          data-testid="knowledge-save-leave"
          :loading="saving"
          @click="emit('save')"
          :label="text.saveAndLeave"
        />
      </div>
    </template>
  </UModal>
</template>
