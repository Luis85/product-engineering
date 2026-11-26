<script setup lang="ts">
import { nextTick, ref, useId, watch } from "vue";
import type { Component } from "vue";
import {
  PROJECT_ADMINISTRATION,
  projectAdministrationSections,
} from "../../../application/projects";
import type { ProjectAdministrationSection, ProjectSettings } from "../../../application/projects";
import { useMessages, useRoute } from "../../shell";
import ProjectDetailsForm from "./ProjectDetailsForm.vue";
import ProjectTeam from "./ProjectTeam.vue";
import ProjectArtifactRules from "./ProjectArtifactRules.vue";
import ProjectDefinitions from "./ProjectDefinitions.vue";
import ProjectTemplates from "./ProjectTemplates.vue";
import ProjectIntegrations from "./ProjectIntegrations.vue";

defineProps<{ readonly project: ProjectSettings }>();
const text = useMessages().projects;
const sections = projectAdministrationSections;
const labels = {
  project: text.groups.project,
  team: text.team.title,
  requirements: text.artifacts.title,
  definitions: text.definitions.title,
  templates: text.templates.title,
  integrations: text.integrations.title,
};
const panels = {
  project: ProjectDetailsForm,
  team: ProjectTeam,
  requirements: ProjectArtifactRules,
  definitions: ProjectDefinitions,
  templates: ProjectTemplates,
  integrations: ProjectIntegrations,
} satisfies Record<ProjectAdministrationSection, Component>;
const active = ref<ProjectAdministrationSection>("project");
const route = useRoute();
watch(
  route,
  (current) => {
    if (current.name === PROJECT_ADMINISTRATION && current.section) active.value = current.section;
  },
  { immediate: true },
);
const tablist = ref<HTMLElement>();
const id = useId();

async function move(event: KeyboardEvent, index: number) {
  const last = sections.length - 1;
  const target =
    event.key === "Home"
      ? 0
      : event.key === "End"
        ? last
        : event.key === "ArrowRight"
          ? (index + 1) % sections.length
          : event.key === "ArrowLeft"
            ? (index + last) % sections.length
            : index;
  const section = sections[target];
  if (!section || target === index) return;
  event.preventDefault();
  active.value = section;
  await nextTick();
  tablist.value?.querySelector<HTMLElement>(`[data-section="${section}"]`)?.focus();
}
</script>

<template>
  <div
    ref="tablist"
    role="tablist"
    :aria-label="text.administration"
    class="pe:flex pe:flex-wrap pe:gap-1 pe:border-b pe:border-default pe:pb-2"
  >
    <button
      v-for="(section, index) in sections"
      :id="`${id}-tab-${section}`"
      :key="section"
      type="button"
      role="tab"
      :aria-selected="active === section"
      :aria-controls="`${id}-panel-${section}`"
      :tabindex="active === section ? 0 : -1"
      :data-section="section"
      :data-pe-focus-key="`project-settings-${section}`"
      class="pe:rounded pe:px-3 pe:py-2 pe:text-sm pe:font-semibold pe:aria-selected:bg-muted pe:aria-selected:text-highlighted"
      @click="active = section"
      @keydown="move($event, index)"
    >
      {{ labels[section] }}
    </button>
  </div>
  <section
    v-for="section in sections"
    v-show="active === section"
    :id="`${id}-panel-${section}`"
    :key="section"
    role="tabpanel"
    :aria-labelledby="`${id}-tab-${section}`"
    class="pe:grid pe:min-w-0 pe:gap-4"
  >
    <component :is="panels[section]" :project="project" />
  </section>
</template>
