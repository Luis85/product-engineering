<script setup lang="ts">
import UButton from "@nuxt/ui/components/Button.vue";
import UTextarea from "@nuxt/ui/components/Textarea.vue";
import { useId } from "vue";
import type { Project } from "../../../application/projects";
import type { Route } from "../../../application/routes";
import { useCopilotWorkspace } from "../use-copilot-workspace";
import CopilotActions from "./CopilotActions.vue";
import CopilotConversation from "./CopilotConversation.vue";
import CopilotError from "./CopilotError.vue";
import CopilotProposalReview from "./CopilotProposalReview.vue";
import CopilotSelect from "./CopilotSelect.vue";
import CopilotSources from "./CopilotSources.vue";
import CopilotTask from "./CopilotTask.vue";

const { project, review } = defineProps<{ readonly project: Project; readonly review: boolean }>();
const emit = defineEmits<{ destination: [Route]; citation: [Route] }>();
const messageId = useId();
const {
  catalog,
  text,
  capability,
  options,
  mode,
  draftKind,
  selected,
  revisionTarget,
  availableTargets,
  thread,
  threads,
  instructions,
  instructionsOpen,
  write,
  form,
  state,
  working,
  stopped,
  proposal,
  staleProposal,
  apply,
  citations,
  failure,
  missingExecutable,
  saveComposer,
  updateSources,
  showThread,
  chooseMode,
  chooseDraftKind,
  chooseTarget,
  applyProposal,
  stop,
  canSend,
} = useCopilotWorkspace(project, review, (route) => emit("destination", route));
</script>

<template>
  <div v-if="capability.enabled" data-testid="agent-chat-screen">
    <section data-testid="copilot-workspace" class="pe-copilot-workspace">
      <header class="pe-copilot-project">
        <h2>{{ project.name }}</h2>
        <p>{{ catalog.settings.ai.modes[capability.mode] }}</p>
      </header>
      <div class="pe-copilot-thread">
        <CopilotSelect
          :label="text.thread"
          :value="thread"
          test-id="copilot-thread"
          @choose="showThread"
        >
          <option value="">{{ text.newThread }}</option>
          <option v-for="entry in threads" :key="entry.id" :value="entry.id">
            {{ entry.messages[0]?.content }}
          </option>
        </CopilotSelect>
        <UButton
          type="button"
          icon="i-lucide-plus"
          color="neutral"
          variant="outline"
          class="pe-copilot-new-thread"
          :aria-label="text.newThread"
          @click="showThread('')"
        />
      </div>

      <CopilotConversation
        :state="state"
        :citations="citations"
        @destination="emit('citation', $event)"
      />
      <CopilotProposalReview
        v-if="proposal"
        :key="proposal.context.id"
        :content="proposal.content"
        :kind="proposal.context.kind"
        :stale="staleProposal"
        :pending="apply.pending.value"
        @apply="applyProposal"
      />
      <CopilotError :failure="failure" :missing-executable="missingExecutable" />

      <form class="pe-copilot-form" @submit.prevent="form.handleSubmit()">
        <CopilotTask
          :mode="mode"
          :draft-kind="draftKind"
          :target="revisionTarget"
          :options="availableTargets"
          @mode="chooseMode"
          @kind="chooseDraftKind"
          @target="chooseTarget"
        />
        <CopilotSources :options="options" :selected="selected" @toggle="updateSources" />
        <details
          class="pe-copilot-instructions"
          @toggle="instructionsOpen = ($event.currentTarget as HTMLDetailsElement).open"
        >
          <summary>{{ text.instructions }}</summary>
          <UTextarea
            v-if="instructionsOpen"
            v-model="instructions"
            :aria-label="text.instructions"
            :maxlength="8000"
            class="pe:mt-2 pe:w-full"
            @update:model-value="(value) => write.run(project.id, { instructions: value })"
          />
        </details>
        <label class="pe-copilot-prompt-label" :for="messageId">{{ catalog.chat.message }}</label>
        <form.Field v-slot="{ field }" name="message">
          <UTextarea
            :id="messageId"
            :name="field.name"
            :model-value="field.state.value"
            :rows="3"
            :maxlength="8000"
            data-testid="copilot-prompt"
            class="pe-copilot-prompt"
            @blur="field.handleBlur()"
            @update:model-value="
              (value) => {
                field.handleChange(value);
                saveComposer();
              }
            "
          />
        </form.Field>
        <CopilotActions
          :stopped="stopped"
          :working="Boolean(working)"
          :can-send="canSend"
          @stop="stop"
        />
      </form>
    </section>
  </div>
</template>
