<script setup lang="ts">
import UButton from "@nuxt/ui/components/Button.vue";
import USlideover from "@nuxt/ui/components/Slideover.vue";
import { computed, defineAsyncComponent, ref, watch } from "vue";
import { aiCapability } from "../../../application/integrations";
import { useMessages, useModal, useRouting, useSettings } from "../../shell";

const { focusWorkspace } = defineProps<{ readonly focusWorkspace: () => void }>();
const text = useMessages().projects;
const { definition } = useRouting();
const settings = useSettings();
const assistant = definition.context ? defineAsyncComponent(definition.context) : undefined;
const capability = computed(() => aiCapability(settings.value));
const open = ref(false);
let trigger: HTMLElement | undefined;
let settingsChanged = false;
const modal = useModal(open, () => {
  if (settingsChanged || !trigger?.isConnected) focusWorkspace();
  else trigger.focus({ preventScroll: true });
});
watch(
  capability,
  (next, previous) => {
    if (!open.value || (next.enabled === previous.enabled && next.mode === previous.mode)) return;
    settingsChanged = true;
    open.value = false;
  },
  { flush: "sync" },
);

function show(event: MouseEvent) {
  settingsChanged = false;
  trigger = event.currentTarget as HTMLElement;
  open.value = true;
}
</script>

<template>
  <template v-if="assistant">
    <UButton
      v-if="capability.enabled"
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
        <component :is="assistant" v-if="open" />
      </template>
    </USlideover>
  </template>
</template>
