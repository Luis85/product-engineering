<script setup lang="ts">
import { computed, shallowRef } from "vue";
import { projectGatePhases, projectReleaseRules } from "../../../application/projects";
import type {
  ProjectCriterion,
  ProjectGatePhase,
  ProjectSettings,
} from "../../../application/projects";
import { useMessages } from "../../shell";
import ProjectCriterionDialog from "./ProjectCriterionDialog.vue";
import ProjectPhaseRules from "./ProjectPhaseRules.vue";

const { project } = defineProps<{ readonly project: ProjectSettings }>();
const text = useMessages().projects.definitions;
const rules = computed(() => projectReleaseRules(project));
const editor = shallowRef<{
  phase: ProjectGatePhase;
  version: number;
  criterion: ProjectCriterion | undefined;
}>();
let trigger: HTMLElement | undefined;

function edit(event: MouseEvent, phase: ProjectGatePhase, criterion?: ProjectCriterion) {
  if (!rules.value) return;
  trigger = event.currentTarget as HTMLElement;
  editor.value = { phase, version: rules.value.version, criterion };
}
</script>

<template>
  <div v-if="rules" class="pe:grid pe:max-w-3xl pe:gap-4">
    <div class="pe:grid pe:gap-1">
      <h2 class="pe:text-lg pe:font-semibold">{{ text.title }}</h2>
      <p :data-rule-version="rules.version" class="pe:text-sm pe:font-semibold">
        {{ text.version(rules.version) }}
      </p>
      <p class="pe:text-sm pe:text-muted">{{ text.help }}</p>
    </div>
    <ProjectPhaseRules
      v-for="phase in projectGatePhases"
      :key="phase"
      :phase="phase"
      :criteria="rules[phase]"
      @edit="(event, criterion) => edit(event, phase, criterion)"
    />
  </div>
  <p v-else role="alert">{{ text.errors.unavailable }}</p>
  <ProjectCriterionDialog
    v-if="editor"
    v-bind="editor"
    :project-id="project.id"
    :after-close="() => trigger?.focus()"
    @dismiss="editor = undefined"
  />
</template>
