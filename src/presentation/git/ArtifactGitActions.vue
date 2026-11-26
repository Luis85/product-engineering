<script setup lang="ts">
import UButton from "@nuxt/ui/components/Button.vue";
import { computed } from "vue";
import { useMessages } from "../shell";
import type { ArtifactGitWorkflow } from "./workflow";

const { dirty, editable, history, saving, git } = defineProps<{
  readonly dirty: boolean;
  readonly editable: boolean;
  readonly history: boolean;
  readonly saving: boolean;
  readonly git: ArtifactGitWorkflow;
}>();
const emit = defineEmits<{ compare: []; commit: [event: Event]; saveAndCommit: [event: Event] }>();
const text = useMessages().git;
const canStart = computed(() => editable && !dirty && git.canCommit.value);
const canSave = computed(() => editable && dirty && git.journal.value && !git.inspect.error.value);
</script>

<template>
  <div v-if="canStart" class="pe-note-actions">
    <UButton
      v-if="!history"
      type="button"
      variant="soft"
      data-testid="git-compare-saved"
      :label="text.compareSaved"
      @click="emit('compare')"
    />
    <UButton
      type="button"
      data-testid="git-commit"
      :label="text.commit"
      @click="emit('commit', $event)"
    />
  </div>
  <UButton
    v-if="canSave"
    type="button"
    variant="soft"
    class="pe:justify-self-start"
    data-testid="git-save-and-commit"
    :loading="saving"
    :label="text.saveThenCommit"
    @click="emit('saveAndCommit', $event)"
  />
  <p v-if="git.announced.value" role="status" data-testid="git-announcement">
    {{ text.committed }} · {{ git.announced.value.slice(0, 8) }}
  </p>
</template>
