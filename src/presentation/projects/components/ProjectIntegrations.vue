<script setup lang="ts">
import UButton from "@nuxt/ui/components/Button.vue";
import { computed, ref, useId, watch } from "vue";
import {
  openProjectIntegrationSettings,
  projectIntegrationPolicy,
  setProjectMcpRead,
  testProjectMcpRead,
} from "../../../application/projects";
import type { ProjectSettings } from "../../../application/projects";
import { ErrorNotice, useCommand, useMessages, useQuery } from "../../shell";
import ProjectDataClassification from "./ProjectDataClassification.vue";

const { project } = defineProps<{ readonly project: ProjectSettings }>();
const messages = useMessages().projects;
const text = messages.integrations;
const id = useId();
const policy = computed(() => projectIntegrationPolicy(project));
const scope = useCommand(setProjectMcpRead);
const settings = useCommand(openProjectIntegrationSettings);
const test = useQuery(testProjectMcpRead);
const checked = ref(policy.value.mcpRead);
const showTest = ref(false);

watch(
  () => policy.value.mcpRead,
  (enabled) => {
    checked.value = enabled;
  },
);
const testScope = computed(() =>
  JSON.stringify([checked.value, project.repository, project.branch, policy.value.dataClass]),
);
watch(testScope, () => {
  showTest.value = false;
});

async function toggle() {
  if (scope.pending.value) return;
  const outcome = await scope.run(project.id, !checked.value);
  if (outcome._tag !== "success") return;
  checked.value = projectIntegrationPolicy(outcome.value).mcpRead;
}

async function query() {
  const scopeAtStart = testScope.value;
  const outcome = await test.run(project.id);
  showTest.value = outcome._tag === "success" && scopeAtStart === testScope.value;
}
</script>

<template>
  <section class="pe:grid pe:max-w-3xl pe:gap-4 pe:rounded-md pe:border pe:border-default pe:p-4">
    <h2 class="pe:text-lg pe:font-semibold">{{ text.title }}</h2>
    <dl class="pe:grid pe:gap-1 pe:[overflow-wrap:anywhere]">
      <dt class="pe:text-sm pe:font-semibold">{{ messages.repository }}</dt>
      <dd>{{ project.repository || text.unconfigured }}</dd>
    </dl>
    <div class="pe:grid pe:min-w-0 pe:gap-2">
      <button
        type="button"
        role="switch"
        :aria-checked="checked"
        :aria-describedby="`${id}-scope`"
        :aria-disabled="scope.pending.value"
        class="pe:flex pe:w-fit pe:items-center pe:gap-2 pe:text-left pe:font-semibold"
        @click="toggle"
      >
        <span
          aria-hidden="true"
          class="pe:relative pe:h-5 pe:w-9 pe:shrink-0 pe:rounded-full pe:border pe:border-default"
          :class="checked ? 'pe:bg-primary' : 'pe:bg-muted'"
        >
          <span
            class="pe:absolute pe:top-0.5 pe:size-3.5 pe:rounded-full pe:bg-default"
            :class="checked ? 'pe:right-0.5' : 'pe:left-0.5'"
          />
        </span>
        <span>{{ text.scope }}</span>
      </button>
      <p :id="`${id}-scope`" class="pe:text-sm pe:text-muted">{{ text.scopeHelp }}</p>
    </div>
    <ErrorNotice v-if="scope.message.value" :message="scope.message.value" />
    <details class="pe:grid pe:gap-2">
      <summary class="pe:cursor-pointer pe:font-semibold">{{ text.contract }}</summary>
      <p class="pe:mt-2 pe:text-sm pe:text-muted">{{ text.packageHelp }}</p>
    </details>
    <div class="pe:flex pe:flex-wrap pe:gap-2">
      <UButton type="button" variant="soft" :loading="test.pending.value" @click="query">{{
        text.test
      }}</UButton>
      <UButton
        type="button"
        variant="outline"
        color="neutral"
        class="pe:whitespace-normal"
        @click="settings.run()"
        >{{ text.settings }}</UButton
      >
    </div>
    <ErrorNotice v-if="settings.message.value" :message="settings.message.value" />
    <p
      v-if="showTest && test.value.value"
      role="status"
      data-testid="project-mcp-result"
      :data-state="test.value.value"
      class="pe:text-sm"
    >
      {{ text.results[test.value.value] }}
    </p>
  </section>
  <ProjectDataClassification :project="project" />
</template>
