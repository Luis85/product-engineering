<script setup lang="ts">
import { useId } from "vue";
import { useMessages } from "../shell";
import type { RequestDetailTab as Tab } from "./request-detail-state";

const { active } = defineProps<{ readonly active: Tab }>();
const emit = defineEmits<{ select: [Tab] }>();
const tabs = ["package", "gates", "run", "evidence"] as const;
const text = useMessages()["feature-requests"];
const id = useId();

function focusTab(event: KeyboardEvent, tab: Tab) {
  const index = tabs.indexOf(tab);
  const next = { ArrowLeft: (index + 3) % 4, ArrowRight: (index + 1) % 4, Home: 0, End: 3 }[
    event.key
  ];
  if (next === undefined) return;
  event.preventDefault();
  const controls = (
    event.currentTarget as HTMLElement
  ).parentElement?.querySelectorAll<HTMLElement>("[role=tab]");
  controls?.[next]?.focus();
}
</script>

<template>
  <div
    role="tablist"
    :aria-label="text.request"
    class="pe:flex pe:flex-wrap pe:gap-1 pe:border-b pe:border-default"
  >
    <button
      v-for="tab in tabs"
      :id="id + '-' + tab"
      :key="tab"
      type="button"
      role="tab"
      :tabindex="active === tab ? 0 : -1"
      :aria-selected="active === tab"
      :aria-controls="id + '-panel-' + tab"
      :data-testid="tab === 'gates' ? 'request-toggle-gates' : 'request-tab-' + tab"
      :data-pe-focus-key="'request-tab-' + tab"
      class="pe:rounded-t-md pe:px-3 pe:py-2 pe:text-sm pe:font-medium pe:hover:bg-muted pe:aria-selected:bg-elevated pe:aria-selected:underline"
      @keydown="focusTab($event, tab)"
      @click="emit('select', tab)"
    >
      {{ text[tab] }}
    </button>
  </div>
  <div
    v-for="tab in tabs"
    :id="id + '-panel-' + tab"
    :key="tab"
    role="tabpanel"
    :aria-labelledby="id + '-' + tab"
    :hidden="active !== tab"
  >
    <slot v-if="active === tab" :name="tab" />
  </div>
</template>
