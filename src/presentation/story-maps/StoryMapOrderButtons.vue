<script setup lang="ts">
import UButton from "@nuxt/ui/components/Button.vue";
import { computed } from "vue";
import { useMessages } from "../shell";

const {
  index,
  length,
  vertical = false,
  compact = false,
} = defineProps<{
  readonly index: number;
  readonly length: number;
  readonly vertical?: boolean;
  readonly compact?: boolean;
}>();
const emit = defineEmits<{ move: [offset: -1 | 1] }>();
const text = useMessages()["story-maps"].journey;
const icons = {
  vertical: { "-1": "i-lucide-arrow-up", "1": "i-lucide-arrow-down" },
  horizontal: { "-1": "i-lucide-arrow-left", "1": "i-lucide-arrow-right" },
} as const;
const buttons = computed(() =>
  ([-1, 1] as const).map((offset) => {
    const axis = vertical ? "vertical" : "horizontal";
    const label = text[axis][offset];
    return {
      offset,
      label,
      caption: compact ? "" : label,
      icon: icons[axis][offset],
      disabled: index + offset < 0 || index + offset >= length,
    };
  }),
);
</script>

<template>
  <div
    v-if="length > 1"
    class="pe:flex pe:flex-wrap pe:gap-1"
    role="group"
    :aria-label="text.order"
  >
    <UButton
      v-for="button in buttons"
      :key="button.offset"
      type="button"
      variant="ghost"
      color="neutral"
      size="xs"
      :disabled="button.disabled"
      :aria-label="button.label"
      :title="button.label"
      :icon="button.icon"
      @click="emit('move', button.offset)"
      >{{ button.caption }}</UButton
    >
  </div>
</template>
