<script setup lang="ts">
import UButton from "@nuxt/ui/components/Button.vue";
import { useForm } from "@tanstack/vue-form";
import { computed } from "vue";
import { validKnowledgeTitle } from "../../../application/knowledge";
import { COPILOT_PROPOSAL_LIMIT, isCopilotProposalContent } from "../../../domain/integrations";
import type { CopilotDraftKind, CopilotProposalContent } from "../../../domain/integrations";
import { useMessages } from "../../shell";
import CopilotMarkdown from "./CopilotMarkdown.vue";

const { content, kind, stale, pending } = defineProps<{
  readonly content: CopilotProposalContent;
  readonly kind: CopilotDraftKind;
  readonly stale: boolean;
  readonly pending: boolean;
}>();
const emit = defineEmits<{ apply: [content: CopilotProposalContent, saveAsNew: boolean] }>();
const text = useMessages().integrations.copilot;
const form = useForm({ defaultValues: { ...content } });
const values = form.useSelector((state) => state.values);
const ready = computed(
  () => validKnowledgeTitle(kind, values.value.title) && isCopilotProposalContent(values.value),
);
function apply(asNew: boolean) {
  if (!pending && ready.value && (asNew || !stale)) emit("apply", { ...values.value }, asNew);
}
</script>

<template>
  <section
    data-testid="copilot-proposal"
    class="pe:grid pe:min-w-0 pe:gap-3 pe:rounded pe:border pe:border-default pe:p-3"
  >
    <h3 class="pe:text-base pe:font-semibold">{{ text.proposal }}</h3>
    <label class="pe:grid pe:gap-1 pe:text-sm">
      {{ text.proposalTitle }}
      <form.Field v-slot="{ field }" name="title">
        <input
          data-testid="copilot-proposal-title"
          :value="field.state.value"
          class="pe:min-w-0 pe:rounded pe:border pe:border-default pe:bg-default pe:p-2"
          maxlength="160"
          @input="field.handleChange(($event.currentTarget as HTMLInputElement).value)"
        />
      </form.Field>
    </label>
    <label class="pe:grid pe:gap-1 pe:text-sm">
      {{ text.proposalBody }}
      <form.Field v-slot="{ field }" name="body">
        <textarea
          data-testid="copilot-proposal-body"
          :value="field.state.value"
          class="pe:min-w-0 pe:rounded pe:border pe:border-default pe:bg-default pe:p-2"
          :maxlength="COPILOT_PROPOSAL_LIMIT"
          rows="6"
          @input="field.handleChange(($event.currentTarget as HTMLTextAreaElement).value)"
        />
      </form.Field>
    </label>
    <CopilotMarkdown :markdown="values.body" />
    <p v-if="stale" role="alert" class="pe:text-sm">{{ text.proposalStale }}</p>
    <div class="pe:flex pe:flex-wrap pe:justify-end pe:gap-2">
      <UButton
        v-if="stale"
        type="button"
        data-testid="copilot-save-as-new"
        :disabled="pending || !ready"
        @click="apply(true)"
        >{{ text.saveAsNew }}</UButton
      >
      <UButton
        type="button"
        data-testid="copilot-apply"
        :disabled="pending || !ready || stale"
        @click="apply(false)"
        >{{ text.apply }}</UButton
      >
    </div>
  </section>
</template>
