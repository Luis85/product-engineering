<script setup lang="ts">
import UButton from "@nuxt/ui/components/Button.vue";
import { computed } from "vue";
import { aiCapability } from "../../../application/integrations";
import { projectsRoute } from "../../../application/projects";
import { useCopilotProject } from "../../projects";
import { useMessages, useSettings } from "../../shell";
import CopilotWorkspace from "./CopilotWorkspace.vue";
import NeutralAgentChat from "./NeutralAgentChat.vue";

const context = useCopilotProject();
const project = computed(() => context?.project());
const settings = useSettings();
const catalog = useMessages();
const enabled = computed(() => aiCapability(settings.value).enabled);
</script>

<template>
  <CopilotWorkspace
    v-if="project && enabled"
    :key="project.id"
    :project="project"
    :review="false"
    @destination="context?.navigate($event)"
    @citation="context?.followCitation($event)"
  />
  <div
    v-else-if="context && enabled"
    data-testid="agent-chat-screen"
    class="pe:grid pe:justify-items-start pe:gap-3"
  >
    <h1 class="pe:text-lg pe:font-semibold">{{ catalog.integrations.copilot.heading }}</h1>
    <UButton
      data-testid="copilot-choose-project"
      type="button"
      :label="catalog.projects.choose"
      @click="context.navigate(projectsRoute)"
    />
  </div>
  <NeutralAgentChat v-else />
</template>
