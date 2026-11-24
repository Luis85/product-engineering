<script setup lang="ts">
import UButton from "@nuxt/ui/components/Button.vue";
import { computed } from "vue";
import type { BacklogTab } from "../../application/backlog";
import type { ProjectId } from "../../application/projects";
import { backlogKinds } from "../../domain/backlog";
import type { BacklogKind } from "../../domain/backlog";
import { useMessages } from "../shell";
import BacklogFilterSelect from "./BacklogFilterSelect.vue";
import BacklogTabs from "./BacklogTabs.vue";
import type { BacklogFilters } from "./preferences";

const {
  active,
  project,
  states,
  priorities,
  canCreate,
  canUndo,
  statusLabels = undefined,
} = defineProps<{
  readonly active: BacklogTab;
  readonly project: ProjectId;
  readonly states: readonly string[];
  readonly priorities: readonly string[];
  readonly canCreate: boolean;
  readonly canUndo: boolean;
  readonly statusLabels?: Readonly<Record<string, string>>;
}>();
const filters = defineModel<BacklogFilters>({ required: true });
const emit = defineEmits<{
  create: [HTMLElement];
  undo: [];
  base: [];
  reset: [];
}>();
const text = useMessages().backlog;
const filtered = computed(() => {
  const { query, level, status, priority } = filters.value;
  return Boolean(query || (active === "list" && level) || status || priority);
});

function input(event: Event) {
  return (event.target as HTMLInputElement | HTMLSelectElement).value;
}
</script>

<template>
  <div class="pe-backlog-toolbar">
    <section :aria-label="text.views" class="pe-backlog-actions">
      <BacklogTabs :active="active" :project="project" />
      <UButton
        v-if="canCreate && active === 'list'"
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
        data-pe-focus-key="backlog-search"
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
        :labels="statusLabels"
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
