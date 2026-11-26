<script setup lang="ts">
import UButton from "@nuxt/ui/components/Button.vue";
import { useMessages } from "../../shell";

const { stopped, working, canSend } = defineProps<{
  readonly stopped: boolean;
  readonly working: boolean;
  readonly canSend: boolean;
}>();
const emit = defineEmits<{ stop: [] }>();
const catalog = useMessages().integrations;
</script>

<template>
  <div class="pe-copilot-actions">
    <p role="status" class="pe:mr-auto pe:text-muted">
      {{ stopped ? catalog.chat.stopped : working ? catalog.chat.responding : "" }}
    </p>
    <UButton
      v-if="working || stopped"
      type="button"
      data-testid="stop-response"
      color="neutral"
      variant="outline"
      :aria-disabled="!working"
      @click="emit('stop')"
      >{{ catalog.copilot.cancel }}</UButton
    >
    <UButton type="submit" icon="i-lucide-send" :aria-disabled="!canSend">
      {{ catalog.chat.send }}
    </UButton>
  </div>
</template>
