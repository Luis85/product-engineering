<script setup lang="ts">
import UButton from "@nuxt/ui/components/Button.vue";
import { computed } from "vue";
import { backlogTabs } from "../../application/backlog";
import type { BacklogTab } from "../../application/backlog";
import { backlogKinds } from "../../domain/backlog";
import type { BacklogKind } from "../../domain/backlog";
import { useMessages } from "../shell";
import BacklogFilterSelect from "./BacklogFilterSelect.vue";
import type { BacklogFilters } from "./preferences";

const { tabs, active, states, priorities, canCreate, canUndo } = defineProps<{
  readonly tabs: readonly BacklogTab[];
  readonly active: BacklogTab;
  readonly states: readonly string[];
  readonly priorities: readonly string[];
  readonly canCreate: boolean;
  readonly canUndo: boolean;
}>();
const filters = defineModel<BacklogFilters>({ required: true });
const emit = defineEmits<{
  select: [BacklogTab];
  create: [HTMLElement];
  undo: [];
  base: [];
  reset: [];
}>();
const text = useMessages().backlog;
const filtered = computed(() => {
  const { query, level, status, priority } = filters.value;
  return Boolean(query || level || status || priority);
});
const visibleTabs = computed(() => backlogTabs.filter((candidate) => tabs.includes(candidate)));

function input(event: Event) {
  return (event.target as HTMLInputElement | HTMLSelectElement).value;
}
</script>

<template>
  <div class="pe-backlog-toolbar">
    <section :aria-label="text.views" class="pe-backlog-actions">
      <nav :aria-label="text.views" class="pe:flex pe:flex-wrap pe:gap-1">
        <UButton
          v-for="tab in visibleTabs"
          :key="tab"
          type="button"
          color="neutral"
          :variant="active === tab ? 'soft' : 'ghost'"
          :aria-pressed="active === tab"
          :label="text.tabs[tab]"
          @click="emit('select', tab)"
        />
      </nav>
      <UButton
        v-if="canCreate"
        type="button"
        data-testid="backlog-new"
        data-pe-focus-key="backlog-new"
        :label="text.create"
        @click="emit('create', $event.currentTarget as HTMLElement)"
      />
      <UButton
        type="button"
        variant="ghost"
        color="neutral"
        data-testid="backlog-open-base"
        :label="text.openBase"
        @click="emit('base')"
      />
    </section>
    <div v-if="canCreate" class="pe-backlog-filters">
      <input
        name="backlog-search"
        type="search"
        :placeholder="text.search"
        :aria-label="text.search"
        :value="filters.query"
        @input="filters.query = input($event)"
      />
      <select
        v-if="active === 'list'"
        name="backlog-level"
        :aria-label="text.level"
        :value="filters.level"
        @change="filters.level = input($event) as BacklogKind | ''"
      >
        <option value="">{{ text.levels }}</option>
        <option v-for="kind in backlogKinds" :key="kind" :value="kind">
          {{ text.types[kind] }}
        </option>
      </select>
      <BacklogFilterSelect
        v-model="filters.status"
        name="backlog-status"
        :label="text.status"
        :all="text.statuses"
        :options="states"
      />
      <BacklogFilterSelect
        v-model="filters.priority"
        name="backlog-priority"
        :label="text.priority"
        :all="text.priorities"
        :options="priorities"
      />
      <UButton
        v-if="filtered"
        type="button"
        variant="ghost"
        color="neutral"
        :label="text.reset"
        @click="emit('reset')"
      />
      <UButton
        v-if="canUndo"
        type="button"
        variant="soft"
        color="neutral"
        data-testid="backlog-undo"
        :label="text.undo"
        @click="emit('undo')"
      />
    </div>
  </div>
</template>
