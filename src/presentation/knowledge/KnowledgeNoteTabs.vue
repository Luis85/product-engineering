<script setup lang="ts">
import UButton from "@nuxt/ui/components/Button.vue";
import { computed } from "vue";
import { useMessages } from "../shell";

type Pane = "content" | "editing" | "references" | "history";
const { editable, pane } = defineProps<{ readonly editable: boolean; readonly pane: Pane }>();
const emit = defineEmits<{ select: [pane: Pane] }>();
const text = useMessages().knowledge.note;
const entries = computed(() =>
  (["content", "editing", "references", "history"] as const).filter(
    (entry) => editable || entry !== "editing",
  ),
);
</script>

<template>
  <nav class="pe:flex pe:flex-wrap pe:gap-1" :aria-label="text.markdown">
    <UButton
      v-for="tab in entries"
      :key="tab"
      type="button"
      color="neutral"
      :variant="pane === tab ? 'soft' : 'ghost'"
      :aria-pressed="pane === tab"
      :data-testid="'knowledge-' + tab + '-tab'"
      @click="emit('select', tab)"
      :label="text[tab]"
    />
  </nav>
</template>
