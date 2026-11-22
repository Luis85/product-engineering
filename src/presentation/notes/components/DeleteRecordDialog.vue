<script setup lang="ts">
import UButton from "@nuxt/ui/components/Button.vue";
import UModal from "@nuxt/ui/components/Modal.vue";
import { onScopeDispose } from "vue";
import type { AppError } from "../../../application/errors";
import { ErrorNotice, useCommand, useMessages } from "../../shell";
import type { UseCaseFn, useModal } from "../../shell";

const props = defineProps<{
  open: boolean;
  title: string;
  remove: UseCaseFn<[], unknown, AppError>;
  modalProps: ReturnType<typeof useModal>;
}>();
const emit = defineEmits<{ "update:open": [open: boolean]; deleted: [] }>();
const text = useMessages().notes.deleteDialog;
const deletion = useCommand(() => props.remove());
const { pending, message } = deletion;
let active = true;
onScopeDispose(() => {
  active = false;
});

function updateOpen(next: boolean) {
  if (!pending.value) emit("update:open", next);
}

async function confirmDeletion() {
  if (pending.value) return;
  const outcome = await deletion.run();
  if (active && outcome._tag === "success") {
    emit("deleted");
    emit("update:open", false);
  }
}
</script>

<template>
  <UModal
    :open="open"
    :title="text.title(title)"
    :description="text.detail"
    :content="modalProps"
    :close="false"
    :dismissible="!pending"
    :ui="{ title: 'pe:[overflow-wrap:anywhere]', footer: 'pe:flex-wrap pe:justify-end' }"
    @update:open="updateOpen"
  >
    <template v-if="message" #body>
      <ErrorNotice :message="message" />
    </template>
    <template #footer>
      <UButton
        type="button"
        data-autofocus
        color="neutral"
        variant="outline"
        :aria-disabled="pending"
        @click="updateOpen(false)"
      >
        {{ text.cancel }}
      </UButton>
      <UButton type="button" color="error" :aria-disabled="pending" @click="confirmDeletion">
        {{ text.confirm }}
      </UButton>
    </template>
  </UModal>
</template>
