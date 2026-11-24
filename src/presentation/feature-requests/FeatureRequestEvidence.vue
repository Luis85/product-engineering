<script setup lang="ts">
import { computed } from "vue";
import type { FeatureRequestRevision } from "../../application/feature-requests";
import { useMessages } from "../shell";

const { revision } = defineProps<{ readonly revision: FeatureRequestRevision | undefined }>();
const text = useMessages()["feature-requests"];
const technical = computed(() => revision?.technical);
const technicalStatus = computed(() =>
  technical.value ? text.factory.ready : revision?.package ? text.factory.waiting : text.unknown,
);
const decision = computed(() => revision?.decision);
const businessStatus = computed(() => {
  if (decision.value) return text.states[decision.value.decision];
  return revision?.state === "accepted" ? text.states.accepted : text.factory.waiting;
});
const evidence = computed(() =>
  (revision?.package?.package.useCase?.criteria ?? []).map((criterion) => ({
    criterion,
    match: technical.value?.result.evidence.find(
      ({ criterionId, scenarioId }) =>
        criterionId === criterion.id && scenarioId === criterion.scenario_id,
    ),
  })),
);
</script>

<template>
  <section class="pe-request-panel" data-testid="request-evidence">
    <h2>{{ text.evidence }}</h2>
    <dl class="pe-request-detail-fields">
      <div>
        <dt>{{ text.factory.technical }}</dt>
        <dd>{{ technicalStatus }}</dd>
      </div>
      <div>
        <dt>{{ text.factory.business }}</dt>
        <dd>
          {{ businessStatus }}
          <p v-if="decision">{{ decision.explanation }}</p>
        </dd>
      </div>
    </dl>
    <p v-if="technical" class="pe:text-muted">{{ text.factory.fixture }}</p>
    <details
      v-for="{ criterion, match } in evidence"
      :key="criterion.id"
      class="pe-request-disclosure"
      :data-evidence-criterion="criterion.id"
    >
      <summary>{{ criterion.id }} · {{ criterion.scenario_id }} · {{ criterion.text }}</summary>
      <div v-if="technical && match">
        <p>
          {{ text.gateStatus[match.outcome === "passed" ? "passed" : "open"] }} ·
          {{ match.checkId }}
        </p>
        <p>{{ technical.runId }} · {{ text.factory.attempt(technical.attempt) }}</p>
        <p>
          {{ text.factory.commit }} <code>{{ match.commit }}</code>
        </p>
      </div>
      <p v-else>{{ text.factory.waiting }}</p>
    </details>
  </section>
</template>
