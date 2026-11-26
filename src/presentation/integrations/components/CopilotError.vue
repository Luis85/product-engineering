<script setup lang="ts">
import UButton from "@nuxt/ui/components/Button.vue";
import type { ChatProvider } from "../../../application/integrations";
import { openProjectIntegrationSettings } from "../../../application/projects";
import type { UserMessage } from "../../../application/shell";
import { ErrorNotice, useCommand, useMessages } from "../../shell";

const { failure, missingExecutable } = defineProps<{
  readonly failure: UserMessage | undefined;
  readonly missingExecutable: ChatProvider | undefined;
}>();
const text = useMessages().integrations.chat;
const settingsLink = useCommand(openProjectIntegrationSettings);
</script>

<template>
  <ErrorNotice v-if="failure" :message="failure" />
  <UButton
    v-if="missingExecutable"
    type="button"
    color="neutral"
    variant="outline"
    class="pe:w-fit pe:whitespace-normal"
    @click="settingsLink.run(missingExecutable)"
    >{{ text.correctExecutable }}</UButton
  >
  <ErrorNotice v-if="settingsLink.message.value" :message="settingsLink.message.value" />
</template>
