<script setup lang="ts">
import { useId } from "vue";
import { useMessages } from "../shell";
import { pbiTabs } from "../../application/backlog";
import type { PbiTab } from "../../application/backlog";

const { active } = defineProps<{ readonly active: PbiTab }>();
const emit = defineEmits<{ select: [PbiTab, MouseEvent] }>();
const text = useMessages().backlog;
const id = useId();

function focusTab(event: KeyboardEvent, tab: PbiTab) {
  const index = pbiTabs.indexOf(tab);
  const last = pbiTabs.length - 1;
  const next = {
    ArrowLeft: index ? index - 1 : last,
    ArrowRight: index === last ? 0 : index + 1,
    Home: 0,
    End: last,
  }[event.key];
  if (next === undefined) return;
  event.preventDefault();
  const control = event.currentTarget as HTMLElement;
  control.parentElement?.querySelectorAll<HTMLElement>("[role=tab]")[next]?.focus();
}
</script>

<template>
  <div role="tablist" :aria-label="text.pbiViews" class="pe-backlog-actions">
    <button
      v-for="tab in pbiTabs"
      :id="id + '-' + tab"
      :key="tab"
      type="button"
      role="tab"
      :aria-controls="id + '-panel-' + tab"
      :aria-selected="active === tab"
      :tabindex="active === tab ? 0 : -1"
      :data-testid="'pbi-tab-' + tab"
      :data-pe-focus-key="'pbi-tab-' + tab"
      class="pe:rounded-md pe:px-2 pe:py-1 pe:text-sm pe:font-medium pe:hover:bg-muted pe:aria-selected:bg-elevated pe:aria-selected:underline"
      @keydown="focusTab($event, tab)"
      @click="emit('select', tab, $event)"
    >
      {{ text.pbiTabs[tab] }}
    </button>
  </div>
  <div
    v-for="tab in pbiTabs"
    :id="id + '-panel-' + tab"
    :key="tab"
    role="tabpanel"
    :aria-labelledby="id + '-' + tab"
    :hidden="active !== tab"
  >
    <slot v-if="active === tab" :name="tab" />
  </div>
</template>
