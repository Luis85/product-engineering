<script setup lang="ts">
import UButton from "@nuxt/ui/components/Button.vue";
import { computed } from "vue";
import { isKnowledgeId } from "../../domain/knowledge";
import { knowledgeDetailRoute } from "../../application/knowledge";
import { featureRequestNoteOrigin } from "../../application/feature-requests";
import type { FeatureRequest, RequestPackage } from "../../application/feature-requests";
import { useRememberWorkspaceOrigin } from "../projects";
import { useMessages, useNavigate } from "../shell";
import { useRequestDetailState } from "./request-detail-state";

const { record, attachments, draft } = defineProps<{
  readonly record: FeatureRequest;
  readonly attachments: RequestPackage["attachments"] | undefined;
  readonly draft: boolean;
}>();
const text = useMessages()["feature-requests"];
const title = computed(() => (draft ? text.draftAttachments : text.attachments));
const empty = computed(() =>
  !attachments?.length ? (attachments ? text.emptyScope : text.unknown) : undefined,
);
const navigate = useNavigate();
const remember = useRememberWorkspaceOrigin();
const { disclosures } = useRequestDetailState(record);

function toggleAttachment(id: string, event: Event) {
  const node = event.currentTarget as HTMLDetailsElement;
  if (node.open) disclosures.value.add(id);
  else disclosures.value.delete(id);
}

async function sourceNote(id: string, event: MouseEvent) {
  if (!isKnowledgeId(id)) return;
  remember(event.currentTarget as HTMLElement);
  if (
    !(await navigate(
      knowledgeDetailRoute(record.projectId, id, featureRequestNoteOrigin(record.id)),
    ))
  )
    remember(undefined);
}
</script>

<template>
  <section class="pe-request-panel">
    <h2>{{ title }}</h2>
    <p v-if="empty">{{ empty }}</p>
    <details
      v-for="attachment in attachments"
      :key="attachment.id"
      class="pe-request-disclosure"
      :data-attachment="attachment.displayId"
      :open="disclosures.has(attachment.id)"
      @toggle="toggleAttachment(attachment.id, $event)"
    >
      <summary>
        {{ attachment.displayId }} · {{ attachment.title }}
        <code v-if="attachment.commit" :title="attachment.commit">{{
          attachment.commit.slice(0, 7)
        }}</code>
      </summary>
      <pre class="pe-request-markdown">{{ attachment.markdown }}</pre>
      <UButton
        v-if="isKnowledgeId(attachment.id)"
        type="button"
        variant="link"
        class="pe:p-0"
        :label="text.openCurrent"
        :data-pe-focus-key="'request-attachment-' + attachment.id"
        @click="sourceNote(attachment.id, $event)"
      />
    </details>
  </section>
</template>
