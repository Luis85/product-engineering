<script setup lang="ts">
import UButton from "@nuxt/ui/components/Button.vue";
import UPopover from "@nuxt/ui/components/Popover.vue";
import { ref } from "vue";
import { useMessages } from "../shell";

const {
  label,
  title = undefined,
  node = undefined,
} = defineProps<{ readonly label: string; readonly title?: string; readonly node?: string }>();
const text = useMessages()["story-maps"];
const trigger = ref<{ readonly $el: HTMLElement }>();
const open = ref(false);

function invoke(action: (control: HTMLElement | undefined) => void) {
  action(trigger.value?.$el);
  open.value = false;
}
</script>

<template>
  <UPopover
    v-model:open="open"
    :content="{ align: 'start' }"
    :ui="{ content: 'pe:max-w-[min(19rem,calc(100vw-1rem))] pe:overflow-auto' }"
  >
    <UButton
      ref="trigger"
      type="button"
      color="neutral"
      variant="ghost"
      size="sm"
      class="pe-story-tools-trigger"
      :aria-label="label"
      :icon="title ? undefined : 'i-lucide-chevron-down'"
      :title="label"
      :data-story-node="node"
    >
      <template v-if="title">
        <span class="pe:min-w-0 pe:wrap-anywhere pe:text-start">{{ title }}</span>
        <span aria-hidden="true" class="pe-story-disclosure">⌄</span>
      </template>
    </UButton>
    <template #content>
      <div class="pe:grid pe:min-w-0 pe:gap-1 pe:p-2" :aria-label="text.journey.actions">
        <slot :invoke="invoke" />
      </div>
    </template>
  </UPopover>
</template>
