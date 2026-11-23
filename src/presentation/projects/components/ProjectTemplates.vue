<script setup lang="ts">
import UButton from "@nuxt/ui/components/Button.vue";
import { defineAsyncComponent, nextTick, ref, shallowRef, watch } from "vue";
import type { Component } from "vue";
import {
  PROJECT_ADMINISTRATION,
  projectTemplateGroups,
  projectTemplateReturnRoute,
} from "../../../application/projects";
import type { ProjectSettings, ProjectTemplateId } from "../../../application/projects";
import { useMessages, useRoute } from "../../shell";
import { useProjectTemplateFactories } from "../template-factories";
import type { ProjectTemplateFactory } from "../template-factories";

const { project } = defineProps<{ readonly project: ProjectSettings }>();
const text = useMessages().projects.templates;
const factories = useProjectTemplateFactories();
const groups = (["product", "concepts"] as const).map((group) => ({
  group,
  templates: projectTemplateGroups[group].flatMap((template) => {
    const matching = factories.filter((factory) => factory.template === template);
    return matching.length === 1 && matching[0] ? matching : [];
  }),
}));
const route = useRoute();
const panel = ref<HTMLElement>();
const creation = shallowRef<Component>();

async function focusTemplate(template: ProjectTemplateId) {
  await nextTick();
  panel.value?.querySelector<HTMLElement>(`[data-template="${template}"]`)?.focus();
}

watch(
  route,
  (current) => {
    if (
      current.name === PROJECT_ADMINISTRATION &&
      current.section === "templates" &&
      current.returnTemplate
    ) {
      void focusTemplate(current.returnTemplate);
    }
  },
  { immediate: true },
);

function open(factory: ProjectTemplateFactory) {
  const { template } = factory;
  const request = {
    projectId: project.id,
    template,
    returnTo: projectTemplateReturnRoute(project.id, template),
    dismiss() {
      creation.value = undefined;
      void focusTemplate(template);
    },
  };
  creation.value = defineAsyncComponent(async () => factory.create(request));
}
</script>

<template>
  <div ref="panel" class="pe:grid pe:max-w-3xl pe:gap-4">
    <section
      v-for="{ group, templates } in groups"
      :key="group"
      class="pe:grid pe:gap-3 pe:rounded-md pe:border pe:border-default pe:p-4"
    >
      <h2 class="pe:text-lg pe:font-semibold">{{ text.groups[group] }}</h2>
      <p v-if="!templates.length" class="pe:text-sm pe:text-muted">{{ text.empty }}</p>
      <ul v-else class="pe:grid pe:gap-2">
        <li v-for="factory in templates" :key="factory.template">
          <UButton
            type="button"
            variant="soft"
            :data-template="factory.template"
            :data-pe-focus-key="`project-template-${factory.template}`"
            @click="open(factory)"
            >{{ text.create(text.labels[factory.template]) }}</UButton
          >
        </li>
      </ul>
    </section>
  </div>
  <component :is="creation" v-if="creation" />
</template>
