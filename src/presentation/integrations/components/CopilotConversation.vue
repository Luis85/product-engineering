<script setup lang="ts">
import UButton from "@nuxt/ui/components/Button.vue";
import { nextTick, ref, watch } from "vue";
import type { CopilotSource } from "../../../application/integrations";
import type { Route } from "../../../application/routes";
import { useMessages } from "../../shell";
import type { ChatSessionState } from "../chat-session";
import CopilotMarkdown from "./CopilotMarkdown.vue";

const { state, citations } = defineProps<{
  readonly state: ChatSessionState;
  readonly citations: readonly (readonly CopilotSource[])[];
}>();
const emit = defineEmits<{ destination: [Route] }>();
const catalog = useMessages().integrations;
const region = ref<HTMLOListElement>();
watch(
  () => state.messages,
  async () => {
    const log = region.value;
    if (!log || log.scrollHeight - log.scrollTop - log.clientHeight > 24) return;
    await nextTick();
    log.scrollTop = log.scrollHeight;
  },
);
</script>

<template>
  <ol
    ref="region"
    role="log"
    :aria-label="catalog.chat.conversation"
    :aria-busy="state.pending"
    class="pe-copilot-log"
    tabindex="0"
  >
    <li v-if="!state.messages.length" class="pe:text-muted">{{ catalog.copilot.empty }}</li>
    <li v-for="(entry, index) in state.messages" :key="index" class="pe:grid pe:min-w-0 pe:gap-1">
      <strong>{{ catalog.chat.speakers[entry.role] }}</strong>
      <CopilotMarkdown v-if="entry.role === 'assistant'" :markdown="entry.content" />
      <p v-else class="pe:whitespace-pre-wrap pe:[overflow-wrap:anywhere]">{{ entry.content }}</p>
      <div v-if="citations[index]?.length" class="pe:flex pe:flex-wrap pe:gap-2">
        <UButton
          v-for="source in citations[index]"
          :key="source.key"
          type="button"
          size="xs"
          variant="soft"
          data-testid="copilot-source-link"
          :data-source-key="source.key"
          @click="emit('destination', source.route)"
          class="pe:whitespace-normal"
          >{{ source.displayId }} · {{ source.title }}</UButton
        >
      </div>
    </li>
  </ol>
</template>
