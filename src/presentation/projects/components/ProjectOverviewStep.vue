<script setup lang="ts">
import UButton from "@nuxt/ui/components/Button.vue";
import UIcon from "@nuxt/ui/components/Icon.vue";
import { useMessages } from "../../shell";
import type { PlanningCreation, PlanningRow } from "../overview-planning-rows";
import ProjectOverviewLink from "./ProjectOverviewLink.vue";

const { row, position, active } = defineProps<{
  readonly row: PlanningRow;
  readonly position: number;
  readonly active: boolean;
}>();
const emit = defineEmits<{ create: [PlanningCreation, MouseEvent] }>();
const text = useMessages().projects.overviewPlanning;

function create(event: MouseEvent) {
  if (row.creation) emit("create", row.creation, event);
}
</script>

<template>
  <li :aria-current="active ? 'step' : undefined" :data-overview-step="row.id">
    <span class="pe-overview-step-marker" :data-complete="row.complete">
      <template v-if="row.complete">
        <UIcon name="i-lucide-check" aria-hidden="true" />
        <span class="pe:sr-only">{{ text.complete }}</span>
      </template>
      <span v-else aria-hidden="true">{{ position }}</span>
    </span>
    <div class="pe-overview-step-content">
      <h3>{{ text[row.id] }}</h3>
      <p v-if="row.info">{{ row.info }}</p>
      <div v-if="row.links.length" class="pe-overview-step-links">
        <ProjectOverviewLink
          v-for="link in row.links"
          :key="link.key"
          :destination="link.destination"
          :data-pe-focus-key="'overview-' + row.id + '-' + link.key"
          :data-testid="link.testId"
          >{{ link.title }}</ProjectOverviewLink
        >
      </div>
    </div>
    <template v-if="active">
      <ProjectOverviewLink
        v-if="row.destination"
        :destination="row.destination"
        primary
        data-pe-focus-key="overview-next-step"
        >{{ row.action }}</ProjectOverviewLink
      >
      <UButton
        v-else
        type="button"
        :label="row.action"
        data-pe-focus-key="overview-next-step"
        @click="create"
      />
    </template>
  </li>
</template>
