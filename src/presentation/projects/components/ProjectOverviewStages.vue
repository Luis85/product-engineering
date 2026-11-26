<script setup lang="ts">
import { computed } from "vue";
import { featureRequestsRoute } from "../../../application/feature-requests";
import type { ProjectId } from "../../../application/projects";
import { deliveryStages } from "../../../domain/feature-requests";
import type { DeliveryStage } from "../../../domain/feature-requests";
import { useMessages } from "../../shell";
import ProjectOverviewLink from "./ProjectOverviewLink.vue";

const { projectId, counts } = defineProps<{
  readonly projectId: ProjectId;
  readonly counts: ReadonlyMap<DeliveryStage, number>;
}>();
const catalog = useMessages();
const text = catalog.projects.overviewDelivery;
const labels = catalog["feature-requests"].stages;
const metrics = computed(() =>
  deliveryStages.map((stage) => ({
    stage,
    label: labels[stage],
    count: counts.get(stage) ?? 0,
    destination: featureRequestsRoute(projectId, { stage }),
  })),
);
</script>

<template>
  <section>
    <header class="pe-overview-section-head">
      <h2>{{ text.stages }}</h2>
      <ProjectOverviewLink
        :destination="featureRequestsRoute(projectId)"
        data-pe-focus-key="overview-all-requests"
      >
        {{ text.allRequests }}
      </ProjectOverviewLink>
    </header>
    <div
      class="pe-overview-panel pe-overview-stages"
      role="group"
      :aria-label="text.stageGroup"
      data-testid="overview-stages"
    >
      <ProjectOverviewLink
        v-for="metric in metrics"
        :key="metric.stage"
        :destination="metric.destination"
        :aria-label="text.stageLabel(metric.label, metric.count)"
        :data-overview-stage="metric.stage"
        :data-has-requests="Boolean(metric.count)"
        :data-pe-focus-key="'overview-stage-' + metric.stage"
        ><span>{{ metric.label }}</span
        ><strong>{{ metric.count }}</strong></ProjectOverviewLink
      >
    </div>
  </section>
</template>
