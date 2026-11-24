<script setup lang="ts">
import UButton from "@nuxt/ui/components/Button.vue";
import { useMessages } from "../shell";

const { revisions, displayId, selected } = defineProps<{
  readonly revisions: readonly number[];
  readonly displayId: string;
  readonly selected: number | undefined;
}>();
const emit = defineEmits<{ select: [number?] }>();
const text = useMessages()["feature-requests"];
</script>

<template>
  <details v-if="revisions.length" class="pe-request-disclosure" data-testid="request-history">
    <summary>{{ text.history }}</summary>
    <div class="pe:flex pe:flex-wrap pe:gap-1">
      <UButton
        v-if="selected"
        type="button"
        variant="ghost"
        :label="text.currentRevision"
        data-testid="request-current-revision"
        @click="emit('select')"
      />
      <UButton
        v-for="number in revisions"
        :key="number"
        type="button"
        variant="soft"
        :label="text.revision(displayId, number)"
        :data-history-revision="number"
        @click="emit('select', number)"
      />
    </div>
  </details>
</template>
