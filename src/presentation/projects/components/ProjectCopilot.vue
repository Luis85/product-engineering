<script setup lang="ts">
import UButton from "@nuxt/ui/components/Button.vue";
import USlideover from "@nuxt/ui/components/Slideover.vue";
import { defineAsyncComponent, ref, watch } from "vue";
import { useMessages, useModal, useRouting, useSettings } from "../../shell";

const text = useMessages().projects;
const { definition } = useRouting();
const settings = useSettings();
const assistant = definition.context ? defineAsyncComponent(definition.context) : undefined;
const open = ref(false);
let trigger: HTMLElement | undefined;
const modal = useModal(open, () => trigger?.focus({ preventScroll: true }));
watch(
  () => settings.value.aiEnabled,
  (enabled) => {
    if (enabled !== true) open.value = false;
  },
);

function show(event: MouseEvent) {
  trigger = event.currentTarget as HTMLElement;
  open.value = true;
}
</script>

<template>
  <template v-if="settings.aiEnabled === true && assistant">
    <UButton
      :aria-label="text.copilot"
      :title="text.copilot"
      :aria-expanded="open"
      icon="i-lucide-message-square"
      color="neutral"
      variant="ghost"
      type="button"
      @click="show"
    />
    <USlideover v-model:open="open" :title="text.copilot" :content="modal" side="right">
      <template #body>
        <component :is="assistant" />
      </template>
    </USlideover>
  </template>
</template>
