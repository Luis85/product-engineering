<script setup lang="ts">
import UButton from "@nuxt/ui/components/Button.vue";
import { computed, ref } from "vue";
import { projectMembers } from "../../../application/projects";
import type { ProjectSettings } from "../../../application/projects";
import { useMessages } from "../../shell";
import ProjectMemberDialog from "./ProjectMemberDialog.vue";

const { project } = defineProps<{ readonly project: ProjectSettings }>();
const text = useMessages().projects.team;
const members = computed(() => projectMembers(project));
const adding = ref(false);
let trigger: HTMLElement | undefined;

function add(event: MouseEvent) {
  trigger = event.currentTarget as HTMLElement;
  adding.value = true;
}
</script>

<template>
  <div class="pe:flex pe:flex-wrap pe:items-center pe:justify-between pe:gap-3">
    <h2 class="pe:text-lg pe:font-semibold">{{ text.title }}</h2>
    <UButton v-if="members" type="button" variant="soft" @click="add">{{ text.add }}</UButton>
  </div>
  <p v-if="!members" role="alert">{{ text.errors.unavailable }}</p>
  <p v-else-if="!members.length" class="pe:text-muted">{{ text.empty }}</p>
  <table v-else class="pe:w-full pe:table-fixed pe:text-left pe:[overflow-wrap:anywhere]">
    <thead>
      <tr class="pe:border-b pe:border-default">
        <th scope="col" class="pe:p-2">{{ text.name }}</th>
        <th scope="col" class="pe:p-2">{{ text.role }}</th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="member in members" :key="member.id" class="pe:border-b pe:border-default">
        <td class="pe:p-2">{{ member.name }}</td>
        <td class="pe:p-2">{{ text.roles[member.role] }}</td>
      </tr>
    </tbody>
  </table>
  <ProjectMemberDialog
    v-if="adding"
    :project-id="project.id"
    :after-close="() => trigger?.focus()"
    @dismiss="adding = false"
  />
</template>
