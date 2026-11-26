<script setup lang="ts">
import type { CopilotSource } from "../../../application/integrations";
import type { CopilotDraftKind, CopilotMode } from "../../../domain/integrations";
import { useMessages } from "../../shell";
import CopilotSelect from "./CopilotSelect.vue";

const { mode, draftKind, target, options } = defineProps<{
  readonly mode: CopilotMode;
  readonly draftKind: CopilotDraftKind;
  readonly target: string;
  readonly options: readonly CopilotSource[];
}>();
const emit = defineEmits<{ mode: [CopilotMode]; kind: [CopilotDraftKind]; target: [string] }>();
const text = useMessages().integrations.copilot;
</script>

<template>
  <div class="pe-copilot-task" :class="{ 'pe-copilot-task-pair': mode !== 'ask' }">
    <CopilotSelect
      :label="text.mode"
      :value="mode"
      test-id="copilot-mode"
      @choose="emit('mode', $event as CopilotMode)"
    >
      <option v-for="(label, key) in text.modes" :key="key" :value="key">{{ label }}</option>
    </CopilotSelect>
    <CopilotSelect
      v-if="mode === 'draft'"
      :label="text.draftKind"
      :value="draftKind"
      test-id="copilot-draft-kind"
      @choose="emit('kind', $event as CopilotDraftKind)"
    >
      <option v-for="(label, key) in text.draftKinds" :key="key" :value="key">{{ label }}</option>
    </CopilotSelect>
    <CopilotSelect
      v-else-if="mode === 'review' || mode === 'revise'"
      :label="mode === 'review' ? text.reviewTarget : text.revisionTarget"
      :value="target"
      :test-id="mode === 'review' ? 'copilot-review-target' : 'copilot-revision-target'"
      @choose="emit('target', $event)"
    >
      <option value="">
        {{ mode === "review" ? text.chooseReviewTarget : text.chooseTarget }}
      </option>
      <option v-for="source in options" :key="source.key" :value="source.key">
        {{ source.title }}
      </option>
    </CopilotSelect>
  </div>
</template>
