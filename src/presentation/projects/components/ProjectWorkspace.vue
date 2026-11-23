<script setup lang="ts">
import { computed } from "vue";
import {
  PROJECT_ADMINISTRATION,
  PROJECT_RECORD,
  projectChanges,
  projectSnapshot,
  resolveProjectReference,
} from "../../../application/projects";
import { useMessages, useRoute, useStream } from "../../shell";
import { useProjectSearchSources } from "../search-sources";
import ProjectAdministration from "./ProjectAdministration.vue";
import ProjectChooser from "./ProjectChooser.vue";
import ProjectRecordActions from "./ProjectRecordActions.vue";

const text = useMessages().projects;
const route = useRoute();
const snapshot = useStream(projectSnapshot, projectChanges);
const project = computed(() => {
  const current = route.value;
  return "projectId" in current
    ? snapshot.value.projects.find(({ id }) => id === current.projectId)
    : undefined;
});
const record = computed(() => (route.value.name === PROJECT_RECORD ? route.value : undefined));
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
</script>

<template>
  <div data-testid="project-workspace" class="pe:grid pe:min-w-0 pe:gap-4">
    <p v-if="!snapshot.ready" role="status">{{ text.loading }}</p>
    <p v-else-if="snapshot.failed" role="alert">{{ text.unavailable }}</p>
    <template v-else-if="project">
      <h1 tabindex="-1" class="pe:text-2xl pe:font-semibold">
        {{ resolved?.title ?? project.name }}
      </h1>
      <p v-if="!resolved || administration">{{ project.description }}</p>
      <ProjectAdministration v-if="administration" :key="project.id" :project="project" />
      <ProjectRecordActions
        v-if="record"
        :record="record"
        :resolved="resolved"
        :administration="administration"
      />
    </template>
    <ProjectChooser v-else :projects="snapshot.projects" :missing="'projectId' in route" />
  </div>
</template>
