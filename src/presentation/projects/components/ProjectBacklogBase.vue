<script setup lang="ts">
import UButton from "@nuxt/ui/components/Button.vue";
import { computed, watch } from "vue";
import { projectBacklogStatus, repairProjectBacklog } from "../../../application/projects";
import type { ProjectSettings } from "../../../application/projects";
import { ErrorNotice, useCommand, useMessages, useQuery } from "../../shell";

const { project } = defineProps<{ readonly project: ProjectSettings }>();
const text = useMessages().projects;
const status = useQuery(projectBacklogStatus);
const repair = useCommand(repairProjectBacklog);
const message = computed(() => status.message.value ?? repair.message.value);
watch(
  () => project.backlogBasePath,
  () => status.run(project.id),
  { immediate: true },
);

async function restore() {
  const outcome = await repair.run(project.id);
  if (outcome._tag === "success") await status.run(project.id);
}
</script>

<template>
  <dl
    class="pe:grid pe:max-w-3xl pe:gap-3 pe:rounded-md pe:border pe:border-default pe:p-4 pe:[overflow-wrap:anywhere]"
  >
    <div>
      <dt class="pe:text-sm pe:font-semibold">{{ text.backlogPath }}</dt>
      <dd>{{ project.backlogBasePath }}</dd>
    </div>
  </dl>
  <ErrorNotice v-if="message" :message="message" />
  <UButton
    v-if="status.value.value === false"
    type="button"
    variant="soft"
    class="pe:justify-self-start"
    :aria-disabled="repair.pending.value"
    @click="restore"
    >{{ text.repairBase }}</UButton
  >
</template>
