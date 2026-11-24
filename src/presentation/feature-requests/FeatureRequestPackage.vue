<script setup lang="ts">
import UButton from "@nuxt/ui/components/Button.vue";
import { computed } from "vue";
import type { FeatureRequest, RequestPackage } from "../../application/feature-requests";
import { useMessages } from "../shell";
import FeatureRequestAttachments from "./FeatureRequestAttachments.vue";
import FeatureRequestScopeEvidence from "./FeatureRequestScopeEvidence.vue";

const { record, payload, draft, exportJson } = defineProps<{
  readonly record: FeatureRequest;
  readonly payload: RequestPackage | undefined;
  readonly draft: boolean;
  readonly exportJson: string | undefined;
}>();
const text = useMessages()["feature-requests"];
const classify = useMessages().projects.integrations.classes;
const useCase = computed(() => payload?.useCase);
const gherkin = computed(() => payload?.gherkin);
const context = computed(() => ({ nfrs: payload?.nfrs, domain: payload?.domain }));
const attachments = computed(() => payload?.attachments);
const empty = computed(() =>
  payload ? undefined : draft ? text.loadingPackage : text.exportUnavailable,
);
const facts = computed(() => {
  const destination = payload?.destination;
  const requirement = payload?.requirement?.id;
  return [
    ...(destination
      ? [
          [text.destination, `${destination.repository} · ${destination.branch}`],
          [text.classification, classify[destination.dataClass]],
        ]
      : []),
    ...(requirement ? [[text.requirement, requirement]] : []),
  ];
});

function exportPackage(event: MouseEvent) {
  if (!exportJson || !payload) return;
  const owner = (event.currentTarget as HTMLElement).ownerDocument;
  const browser = owner.defaultView;
  if (!browser) return;
  const file = owner.createElement("a");
  const target = browser.URL.createObjectURL(
    new browser.Blob([exportJson], { type: "application/json" }),
  );
  file.href = target;
  file.download = `${record.displayId}-rev-${payload.request.revision}.json`;
  file.click();
  browser.setTimeout(() => browser.URL.revokeObjectURL(target), 0);
}
</script>

<template>
  <section class="pe-request-package" data-testid="request-package">
    <section class="pe-request-panel">
      <div class="pe-request-panel-heading">
        <h2>{{ text.packageContents }}</h2>
        <UButton
          v-if="exportJson"
          type="button"
          variant="soft"
          :label="text.download"
          data-testid="request-export"
          @click="exportPackage"
        />
      </div>
      <dl v-if="facts.length" class="pe-request-detail-fields">
        <div v-for="[label, value] in facts" :key="label">
          <dt>{{ label }}</dt>
          <dd>{{ value }}</dd>
        </div>
      </dl>
      <p v-if="empty">{{ empty }}</p>
      <details v-if="useCase" class="pe-request-disclosure">
        <summary>
          {{ useCase.displayId }} · {{ useCase.title }}
          <code v-if="useCase.commit" :title="useCase.commit">{{
            useCase.commit.slice(0, 7)
          }}</code>
        </summary>
        <pre class="pe-request-markdown">{{ useCase.markdown }}</pre>
        <h3 class="pe:font-semibold">{{ text.criteria }}</h3>
        <ul>
          <li v-for="criterion in useCase.criteria" :key="criterion.id">
            {{ criterion.id }} · {{ criterion.text }}
          </li>
        </ul>
      </details>
      <details v-if="gherkin" class="pe-request-disclosure">
        <summary>{{ text.gherkin }}</summary>
        <pre class="pe-request-markdown">{{ gherkin }}</pre>
      </details>
    </section>
    <FeatureRequestScopeEvidence v-bind="context" />
    <FeatureRequestAttachments :record="record" :attachments="attachments" :draft="draft" />
  </section>
</template>
