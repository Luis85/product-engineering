<script setup lang="ts">
import UButton from "@nuxt/ui/components/Button.vue";
import UModal from "@nuxt/ui/components/Modal.vue";
import type { Project } from "../../../application/projects";
import { useMessages, useModal } from "../../shell";
import { leafModalUi } from "../overlay-ui";

const { afterClose } = defineProps<{
  readonly projects: readonly Project[];
  readonly current: Project | undefined;
  readonly afterClose: () => void;
}>();
const emit = defineEmits<{ create: []; select: [project: Project] }>();
const open = defineModel<boolean>("open", { required: true });
const text = useMessages().projects;
const modal = useModal(open, afterClose);
</script>

<template>
  <UModal v-model:open="open" :title="text.title" :content="modal" :ui="leafModalUi">
    <template #body>
      <div class="pe:grid pe:gap-3">
        <UButton
          v-for="(project, index) in projects"
          :key="project.id"
          :aria-label="project.name"
          :aria-current="project.id === current?.id ? 'true' : undefined"
          :data-autofocus="index === 0 ? '' : undefined"
          type="button"
          color="neutral"
          variant="soft"
          @click="emit('select', project)"
        >
          <span class="pe:min-w-0 pe:truncate">{{ project.name }}</span>
          <span
            v-if="project.id === current?.id"
            aria-hidden="true"
            class="pe:ms-auto pe:rounded-full pe:bg-primary/10 pe:px-2 pe:py-0.5 pe:text-xs pe:font-semibold pe:text-primary"
            >{{ text.active }}</span
          >
        </UButton>
        <UButton
          :data-autofocus="projects.length === 0 ? '' : undefined"
          type="button"
          @click="emit('create')"
          >{{ text.create }}</UButton
        >
      </div>
    </template>
  </UModal>
</template>
