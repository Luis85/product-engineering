<script setup lang="ts">
import UButton from "@nuxt/ui/components/Button.vue";
import { computed } from "vue";
import { useMessages } from "../shell";

const { dirty, saved, conflict, saveFailed, canWrite, showSave, saving, loading } = defineProps<{
  readonly dirty: boolean;
  readonly saved: boolean;
  readonly conflict: boolean;
  readonly saveFailed: boolean;
  readonly canWrite: boolean;
  readonly showSave: boolean;
  readonly saving: boolean;
  readonly loading: boolean;
}>();
const emit = defineEmits<{ save: []; reload: [] }>();
const text = useMessages().knowledge.note;
const status = computed(() => (dirty ? text.dirty : saved ? text.saved : undefined));
const reloadingDisabled = computed(() => saving || loading);
const savingDisabled = computed(() => !dirty || !canWrite);
</script>

<template>
  <p v-if="status" class="pe:text-sm pe:text-muted" role="status">{{ status }}</p>
  <div v-if="conflict" class="pe-note-conflict">
    <p role="alert" data-testid="knowledge-conflict">{{ text.conflict }}</p>
    <UButton
      v-if="canWrite"
      type="button"
      variant="soft"
      data-testid="knowledge-reload"
      :disabled="reloadingDisabled"
      @click="emit('reload')"
      :label="text.reload"
    />
  </div>
  <p v-else-if="saveFailed" role="alert" data-testid="knowledge-save-error">
    {{ text.writeFailed }}
  </p>
  <UButton
    v-if="showSave"
    type="button"
    class="pe:justify-self-start"
    data-testid="knowledge-save"
    :disabled="savingDisabled"
    :loading="saving"
    @click="emit('save')"
    :label="text.save"
  />
</template>
