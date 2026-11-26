<script setup lang="ts">
import { computed } from "vue";
import type { FeatureRequestRevision } from "../../application/feature-requests";
import { useMessages } from "../shell";

const { revision } = defineProps<{ readonly revision: FeatureRequestRevision | undefined }>();
const text = useMessages()["feature-requests"];
const technical = computed(() => revision?.technical);
const technicalStatus = computed(() => {
  const result = technical.value?.result;
  if (result && result.technicalReview.commit === result.commit) return text.factory.ready;
  return revision?.package ? text.factory.waiting : text.unknown;
});
const decision = computed(() => revision?.decision);
const scopeChange = computed(() => {
  if (revision?.state !== "changes-requested") return undefined;
  const change = revision.events.findLast((event) => event.kind === "scope-change");
  return change?.kind === "scope-change" ? change.reply : undefined;
});
const businessStatus = computed(() => {
  if (decision.value) return text.states[decision.value.decision];
  if (scopeChange.value) return text.states["changes-requested"];
  return revision?.state === "accepted" ? text.states.accepted : text.factory.waiting;
});
const evidence = computed(() =>
  (revision?.package?.package.useCase?.criteria ?? []).map((criterion) => ({
    criterion,
    match: technical.value?.result.evidence.find(
      ({ criterionId, scenarioId, commit }) =>
        criterionId === criterion.id &&
        scenarioId === criterion.scenario_id &&
        commit === technical.value?.result.commit,
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
          <p v-else-if="scopeChange">{{ scopeChange }}</p>
        </dd>
      </div>
    </dl>
    <template v-if="technical">
      <p>
        {{ text.factory.commit }} <code>{{ technical.result.commit }}</code>
      </p>
      <p class="pe:text-muted">{{ text.factory.fixture }}</p>
    </template>
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
