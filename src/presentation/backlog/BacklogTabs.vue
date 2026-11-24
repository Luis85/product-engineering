<script setup lang="ts">
import UButton from "@nuxt/ui/components/Button.vue";
import { backlogTabs } from "../../application/backlog";
import type { BacklogTab } from "../../application/backlog";
import { useMessages } from "../shell";

const { active } = defineProps<{ readonly active: BacklogTab }>();
const emit = defineEmits<{ select: [BacklogTab] }>();
const text = useMessages().backlog;
const tabs = backlogTabs.filter((tab) => tab !== "deliverables");
</script>

<template>
  <nav :aria-label="text.views" class="pe:flex pe:flex-wrap pe:gap-1">
    <UButton
      v-for="tab in tabs"
      :key="tab"
      type="button"
      color="neutral"
      :variant="active === tab ? 'soft' : 'ghost'"
      :aria-pressed="active === tab"
      :data-testid="'backlog-tab-' + tab"
      :data-pe-focus-key="'backlog-tab-' + tab"
      :label="text.tabs[tab]"
      @click="emit('select', tab)"
    />
  </nav>
</template>
