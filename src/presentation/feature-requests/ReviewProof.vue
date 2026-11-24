<script setup lang="ts">
import { computed } from "vue";
import type { ReviewWorkspace } from "../../application/feature-requests";
import { useMessages } from "../shell";
import ReviewGherkin from "./ReviewGherkin.vue";

const { review } = defineProps<{ readonly review: ReviewWorkspace }>();
const text = useMessages()["feature-requests"];
const recorded = computed(() => review.entry.decision);
const scopeChange = computed(() => {
  if (review.entry.state !== "changes-requested") return undefined;
  const change = review.entry.events.findLast((event) => event.kind === "scope-change");
  return change?.kind === "scope-change" ? change.reply : undefined;
});
const reason = computed(
  () => (recorded.value?.proof ? undefined : recorded.value?.explanation) || scopeChange.value,
);
const business = computed(() => {
  if (recorded.value) return text.states[recorded.value.decision];
  return scopeChange.value ? text.states["changes-requested"] : text.factory.waiting;
});
const fields = computed(() => [
  {
    label: text.factory.pullRequest,
    value: review.pullRequest ? "#" + review.pullRequest : text.factory.waiting,
  },
  {
    label: text.factory.commit,
    value: review.testedCommit ?? text.factory.waiting,
    code: Boolean(review.testedCommit),
  },
  {
    label: text.run,
    value: review.run
      ? `${review.run.runId} · ${text.factory.attempt(review.run.attempt)}`
      : text.factory.waiting,
  },
  {
    label: text.factory.technical,
    value: review.technicalApproved ? text.factory.ready : text.factory.waiting,
  },
  {
    label: text.review.ci,
    value: review.ciPassed ? text.reviews.ciPassed : text.reviews.ciUnavailable,
  },
  { label: text.review.reviewer, value: review.reviewers.join(", ") || text.review.unassigned },
  { label: text.factory.business, value: business.value },
]);
const gherkin = computed(() => review.entry.package?.package.gherkin);
</script>

<template>
  <section class="pe-request-panel" data-testid="request-evidence">
    <div class="pe-request-panel-heading">
      <h2>{{ text.review.proof }}</h2>
      <ReviewGherkin
        v-if="gherkin"
        :gherkin="gherkin"
        :revision="text.revision(review.record.displayId, review.entry.revision)"
      />
    </div>
    <dl class="pe-request-detail-fields">
      <div v-for="field in fields" :key="field.label">
        <dt>{{ field.label }}</dt>
        <dd>
          <code v-if="field.code">{{ field.value }}</code>
          <template v-else>{{ field.value }}</template>
        </dd>
      </div>
    </dl>
    <ul v-if="review.ciChecks.length">
      <li
        v-for="check in review.ciChecks"
        :key="check.criterionId + '/' + check.scenarioId + '/' + check.checkId"
      >
        {{ check.criterionId }} · {{ check.scenarioId }} · {{ check.checkId }} ·
        {{ text.gateStatus[check.outcome === "passed" ? "passed" : "open"] }}
      </li>
    </ul>
    <p v-if="review.run" class="pe:text-muted">{{ text.factory.fixture }}</p>
    <p v-if="reason" class="pe:whitespace-pre-wrap">{{ reason }}</p>
  </section>
</template>
