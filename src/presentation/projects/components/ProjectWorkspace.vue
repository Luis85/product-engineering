<script setup lang="ts">
import UButton from "@nuxt/ui/components/Button.vue";
import { computed } from "vue";
import { projectKnowledgeRoute } from "../../../application/knowledge";
import {
  PROJECT_ADMINISTRATION,
  PROJECT_OVERVIEW,
  PROJECT_RECORD,
  projectChanges,
  projectSnapshot,
  resolveProjectReference,
} from "../../../application/projects";
import { useMessages, useNavigate, useRoute, useStream } from "../../shell";
import { useProjectRecordScreens } from "../record-screens";
import { useProjectSearchSources } from "../search-sources";
import ProjectAdministration from "./ProjectAdministration.vue";
import ProjectChooser from "./ProjectChooser.vue";
import ProjectOverview from "./ProjectOverview.vue";
import ProjectRecordActions from "./ProjectRecordActions.vue";

const catalog = useMessages();
const text = catalog.projects;
const route = useRoute();
const navigate = useNavigate();
const snapshot = useStream(projectSnapshot, projectChanges);
const project = computed(() => {
  const current = route.value;
  return "projectId" in current
    ? snapshot.value.projects.find(({ id }) => id === current.projectId)
    : undefined;
});
const record = computed(() => (route.value.name === PROJECT_RECORD ? route.value : undefined));
const recordScreens = useProjectRecordScreens();
const recordScreen = computed(() => {
  const current = record.value;
  if (!current) return undefined;
  const screen = recordScreens(current.reference.kind)?.component;
  return screen
    ? { screen, record: current, key: current.projectId + "/" + current.reference.recordId }
    : undefined;
});
const contributors = useProjectSearchSources();
const resolved = computed(() => {
  const current = record.value;
  return current
    ? resolveProjectReference({ projectId: current.projectId, ...current.reference }, contributors)
    : undefined;
});
const administration = computed(
  () =>
    route.value.name === PROJECT_ADMINISTRATION ||
    (resolved.value?.kind === "project" && resolved.value.route.name === PROJECT_ADMINISTRATION),
);
const title = computed(() => resolved.value?.title ?? project.value?.name);
const description = computed(() => {
  if (!recordScreen.value && (!resolved.value || administration.value))
    return project.value?.description;
  return undefined;
});
</script>

<template>
  <div data-testid="project-workspace" class="pe:grid pe:min-w-0 pe:gap-4">
    <p v-if="!snapshot.ready" role="status">{{ text.loading }}</p>
    <p v-else-if="snapshot.failed" role="alert">{{ text.unavailable }}</p>
    <template v-else-if="project">
      <component
        :is="recordScreen.screen"
        v-if="recordScreen"
        :key="recordScreen.key"
        :record="recordScreen.record"
        :resolved="resolved"
      />
      <h1 v-else tabindex="-1" class="pe:wrap-anywhere pe:text-2xl pe:font-semibold">
        {{ title }}
      </h1>
      <p v-if="description">{{ description }}</p>
      <template v-if="route.name === PROJECT_OVERVIEW">
        <ProjectOverview :key="project.id" :project="project" />
        <UButton
          type="button"
          variant="soft"
          icon="i-lucide-book-open"
          class="pe:justify-self-start"
          data-testid="project-knowledge-entry"
          data-pe-focus-key="project-knowledge-entry"
          @click="navigate(projectKnowledgeRoute(project.id))"
          >{{ catalog.knowledge.title }}</UButton
        >
      </template>
      <ProjectAdministration v-if="administration" :key="project.id" :project="project" />
      <ProjectRecordActions
        v-if="record"
        :record="record"
        :resolved="resolved"
        :administration="administration"
        :integrated="Boolean(recordScreen)"
      />
    </template>
    <ProjectChooser v-else :projects="snapshot.projects" :missing="'projectId' in route" />
  </div>
</template>
