<script setup lang="ts">
import UButton from "@nuxt/ui/components/Button.vue";
import { computed, onMounted, watch } from "vue";
import { backlogChanges } from "../../application/backlog";
import type { BacklogSnapshot } from "../../application/backlog";
import {
  featureRequestsChanges,
  featureRequestsRoute,
  featureRequestsSnapshot,
  initialRequestStages,
  requestStageChanges,
} from "../../application/feature-requests";
import type { FeatureRequestsRoute } from "../../application/feature-requests";
import { projectChanges, projectSnapshot } from "../../application/projects";
import { useRestoreWorkspacePosition } from "../projects";
import { useAsyncStream, useMessages, useNavigate, useStream } from "../shell";
import FeatureRequestCreate from "./FeatureRequestCreate.vue";
import FeatureRequestDetail from "./FeatureRequestDetail.vue";
import FeatureRequestTable from "./FeatureRequestTable.vue";

const { route } = defineProps<{ readonly route: FeatureRequestsRoute }>();
const project = route.projectId;
const text = useMessages()["feature-requests"];
const navigate = useNavigate();
const projects = useStream(projectSnapshot, projectChanges);
const registered = computed(() => projects.value.projects.some(({ id }) => id === project));
const requests = useStream(featureRequestsSnapshot(project), featureRequestsChanges(project));
const stages = useAsyncStream(initialRequestStages, requestStageChanges(project));
const backlog = useAsyncStream<BacklogSnapshot, never>(
  { ready: false, items: [], duplicates: [] },
  backlogChanges(project),
);
const visible = computed(() => {
  const stage = route.stage;
  return stage
    ? stages.value.entries.filter((entry) => entry.stage === stage).map(({ record }) => record)
    : requests.value.records;
});
const current = computed(
  () => registered.value && requests.value.records.find(({ id }) => id === route.requestId),
);
const pending = computed(
  () => !requests.value.ready || !projects.value.ready || (route.stage && !stages.value.ready),
);
const canCreate = computed(() => registered.value && !route.requestId);
const activeFilter = computed(() => (canCreate.value && !pending.value ? route.stage : undefined));
const status = computed(() => {
  if (requests.value.failed || projects.value.failed)
    return { text: text.unavailable, alert: true };
  if (pending.value) return { text: text.loading };
  if (route.requestId || !registered.value) return { text: text.missing };
  if (!visible.value.length) return { text: route.stage ? text.phaseEmpty : text.empty };
  return undefined;
});
const restore = useRestoreWorkspacePosition();
onMounted(() => restore());
watch([requests, stages, backlog, () => route.requestId, () => route.stage], () => restore(), {
  flush: "post",
});
</script>

<template>
  <FeatureRequestDetail
    v-if="current"
    :key="current.id"
    :record="current"
    :backlog="backlog"
    :stage="route.stage"
    :origin="route.origin"
    :selected-tab="route.tab"
    :selected-revision="route.revision"
  />
  <section v-else class="pe-feature-requests" data-testid="request-register">
    <header class="pe-request-header">
      <div class="pe:grid pe:min-w-0 pe:gap-1">
        <h1 tabindex="-1" class="pe:text-2xl pe:font-semibold">{{ text.title }}</h1>
        <p v-if="!route.requestId" class="pe:text-sm pe:text-muted">{{ text.intro }}</p>
      </div>
      <FeatureRequestCreate
        v-if="canCreate"
        :project="project"
        :stage="route.stage"
        :initial-backlog="backlog"
      />
      <UButton
        v-if="route.requestId"
        type="button"
        variant="link"
        :label="text.back"
        @click="navigate(featureRequestsRoute(project))"
      />
    </header>
    <div v-if="activeFilter" class="pe-request-filter">
      <span class="pe-request-state">{{ text.stages[activeFilter] }}</span>
      <span data-testid="request-filter-count">{{
        text.filteredCount(visible.length, requests.records.length)
      }}</span>
      <UButton
        type="button"
        variant="link"
        data-testid="request-show-all"
        :label="text.showAll"
        @click="navigate(featureRequestsRoute(project))"
      />
    </div>
    <p
      v-if="status"
      class="pe-request-empty"
      :role="status.alert ? 'alert' : 'status'"
      data-testid="request-empty"
    >
      {{ status.text }}
    </p>
    <FeatureRequestTable v-else :records="visible" :stage="route.stage" :backlog="backlog" />
  </section>
</template>
