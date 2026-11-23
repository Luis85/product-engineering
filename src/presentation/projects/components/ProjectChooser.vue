<script setup lang="ts">
import UButton from "@nuxt/ui/components/Button.vue";
import { nextTick, ref } from "vue";
import { projectOverviewRoute } from "../../../application/projects";
import type { Project } from "../../../application/projects";
import { useMessages, useNavigate } from "../../shell";
import ProjectCreateDialog from "./ProjectCreateDialog.vue";

defineProps<{ projects: readonly Project[]; missing: boolean }>();
const text = useMessages().projects;
const navigate = useNavigate();
const creating = ref(false);
let trigger: HTMLElement | undefined;

function openCreate(event: MouseEvent) {
  trigger = event.currentTarget as HTMLElement;
  creating.value = true;
}

async function cancel() {
  creating.value = false;
  await nextTick();
  trigger?.focus({ preventScroll: true });
}

async function select(selected: Project) {
  if (await navigate(projectOverviewRoute(selected.id))) creating.value = false;
}
</script>

<template>
  <h1 tabindex="-1" class="pe:text-xl pe:font-semibold">{{ text.title }}</h1>
  <p v-if="missing" role="status">{{ text.missing }}</p>
  <p v-else-if="projects.length === 0">{{ text.empty }}</p>
  <ul
    v-if="projects.length"
    class="pe:grid pe:justify-items-start pe:gap-2"
    :aria-label="text.choose"
  >
    <li v-for="project in projects" :key="project.id">
      <UButton
        type="button"
        variant="soft"
        :data-pe-focus-key="project.id"
        @click="select(project)"
        >{{ project.name }}</UButton
      >
    </li>
  </ul>
  <UButton type="button" class="pe:justify-self-start" @click="openCreate">{{
    text.create
  }}</UButton>
  <ProjectCreateDialog v-if="creating" @dismiss="cancel" @created="select" />
</template>
