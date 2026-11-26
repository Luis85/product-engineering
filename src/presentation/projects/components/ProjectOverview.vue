<script setup lang="ts">
import { computed, reactive } from "vue";
import { backlogChanges } from "../../../application/backlog";
import type { BacklogSnapshot } from "../../../application/backlog";
import { initialRequestStages, requestStageChanges } from "../../../application/feature-requests";
import type { ProjectId, ProjectSettings } from "../../../application/projects";
import { useAsyncStream, useMessages, useRouting } from "../../shell";
import ProjectOverviewDelivery from "./ProjectOverviewDelivery.vue";
import ProjectOverviewFoundations from "./ProjectOverviewFoundations.vue";
import ProjectOverviewPlanning from "./ProjectOverviewPlanning.vue";

const { project } = defineProps<{ readonly project: ProjectSettings }>();
const projectId = project.id;
const text = useMessages().projects.overviewDelivery;
const stages = useAsyncStream(initialRequestStages, requestStageChanges(projectId));
const backlog = useAsyncStream<BacklogSnapshot, never>(
  { ready: false, items: [], duplicates: [] },
  backlogChanges(projectId),
);
const hasRequests = computed(() => stages.value.entries.length > 0);
const { navigation } = useRouting();
const projects = disclosures.get(navigation) ?? new Map<ProjectId, Disclosures>();
disclosures.set(navigation, projects);
const saved = projects.get(projectId) ?? reactive({ delivery: false, foundations: false });
projects.set(projectId, saved);
</script>

<script lang="ts">
type Disclosures = { delivery: boolean; foundations: boolean };
const disclosures = new WeakMap<object, Map<ProjectId, Disclosures>>();
</script>

<template>
  <div class="pe-project-overview" data-testid="project-overview">
    <ProjectOverviewDelivery
      v-if="hasRequests"
      :project-id="projectId"
      :backlog="backlog"
      :stages="stages"
    />
    <ProjectOverviewPlanning :project-id="projectId" :backlog="backlog" />
    <details
      v-if="!hasRequests"
      class="pe-overview-panel pe-overview-disclosure"
      :open="saved.delivery"
      @toggle="saved.delivery = ($event.currentTarget as HTMLDetailsElement).open"
    >
      <summary>{{ text.disclose }}</summary>
      <ProjectOverviewDelivery
        v-if="saved.delivery"
        :project-id="projectId"
        :backlog="backlog"
        :stages="stages"
      />
    </details>
    <ProjectOverviewFoundations v-model:open="saved.foundations" :project="project" />
  </div>
</template>
