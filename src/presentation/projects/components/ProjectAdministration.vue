<script setup lang="ts">
import UButton from "@nuxt/ui/components/Button.vue";
import { watch } from "vue";
import { projectBacklogStatus, repairProjectBacklog } from "../../../application/projects";
import type { Project } from "../../../application/projects";
import { ErrorNotice, useCommand, useMessages, useQuery } from "../../shell";

const { project } = defineProps<{ readonly project: Project }>();
const text = useMessages().projects;
const status = useQuery(projectBacklogStatus);
const repair = useCommand(repairProjectBacklog);
watch(
  () => project.backlogBasePath,
  () => status.run(project.id),
  { immediate: true },
);

async function restore() {
  const id = project.id;
  const outcome = await repair.run(id);
  if (outcome._tag === "success" && project.id === id) await status.run(id);
}
</script>

<template>
  <dl
    class="pe:grid pe:max-w-3xl pe:gap-3 pe:rounded-md pe:border pe:border-default pe:p-4 pe:[overflow-wrap:anywhere]"
  >
    <div>
      <dt class="pe:text-sm pe:font-semibold">{{ text.repository }}</dt>
      <dd>{{ project.repository }}</dd>
    </div>
    <div>
      <dt class="pe:text-sm pe:font-semibold">{{ text.folder }}</dt>
      <dd>{{ project.folder }}</dd>
    </div>
    <div>
      <dt class="pe:text-sm pe:font-semibold">{{ text.branch }}</dt>
      <dd>{{ project.branch }}</dd>
    </div>
    <div>
      <dt class="pe:text-sm pe:font-semibold">{{ text.base }}</dt>
      <dd>{{ project.backlogBasePath }}</dd>
    </div>
  </dl>
  <ErrorNotice v-if="status.message.value" :message="status.message.value" />
  <ErrorNotice v-if="repair.message.value" :message="repair.message.value" />
  <UButton
    v-if="status.value.value === false"
    type="button"
    variant="soft"
    class="pe:justify-self-start"
    :aria-disabled="repair.pending.value"
    @click="restore"
  >
    {{ text.repairBase }}
  </UButton>
</template>
