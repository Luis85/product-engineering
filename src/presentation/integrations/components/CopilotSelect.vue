<script setup lang="ts">
import UIcon from "@nuxt/ui/components/Icon.vue";

const { label, value, testId } = defineProps<{
  readonly label: string;
  readonly value: string;
  readonly testId: string;
}>();
const emit = defineEmits<{ choose: [string] }>();
</script>

<template>
  <label>
    {{ label }}
    <span class="pe-copilot-select">
      <select
        :value="value"
        :data-testid="testId"
        @change="emit('choose', ($event.currentTarget as HTMLSelectElement).value)"
      >
        <slot />
      </select>
      <UIcon name="i-lucide-chevron-down" class="pe-copilot-select-chevron" aria-hidden="true" />
    </span>
  </label>
</template>
