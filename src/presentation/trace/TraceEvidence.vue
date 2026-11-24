<script setup lang="ts">
import { computed } from "vue";
import { reviewsRoute } from "../../application/feature-requests";
import type { PbiTrace } from "../../application/trace";
import { useMessages } from "../shell";
import TraceCriteria from "./TraceCriteria.vue";
import TraceLink from "./TraceLink.vue";

const { trace } = defineProps<{ readonly trace: PbiTrace }>();
const text = useMessages().trace;
const current = computed(() => trace.delivery?.request);
const rows = computed(() => {
  const delivery = trace.delivery;
  if (delivery?.review.entry.package?.package.useCase) return delivery.criteria;
  return trace.source.detail?.criteria ?? [];
});
const earlier = computed(() => trace.delivery?.earlier);
const priorReviewRoute = computed(() => {
  const review = earlier.value?.review;
  return (
    review &&
    reviewsRoute(trace.projectId, {
      requestId: review.record.id,
      revision: review.entry.revision,
    })
  );
});
</script>

<template>
  <section class="pe-trace-evidence" data-testid="trace-criteria">
    <h2>
      {{ text.evidence
      }}<template v-if="current">
        · {{ text.revision(current.displayId, current.revision) }}</template
      >
    </h2>
    <TraceCriteria :rows="rows" />
  </section>
  <section v-if="earlier && priorReviewRoute" class="pe-trace-evidence" data-testid="trace-earlier">
    <h2>
      {{ text.previous }} ·
      {{ text.revision(earlier.review.record.displayId, earlier.review.entry.revision) }}
    </h2>
    <div class="pe-trace-prior">
      <TraceLink
        :destination="priorReviewRoute"
        data-pe-focus-key="trace-earlier-review"
        data-testid="trace-earlier-review"
        >{{ text.priorLink }}</TraceLink
      >
      <p>
        <span v-if="earlier.review.pullRequest">PR #{{ earlier.review.pullRequest }} · </span
        ><code>{{ earlier.review.target?.commit }}</code>
      </p>
      <p v-if="earlier.review.baseline?.stale" class="pe-trace-warning">{{ text.stale }}</p>
      <p v-if="earlier.decision" class="pe:whitespace-pre-wrap">
        {{ earlier.decision.state === "accepted" ? text.accepted : text.changes }} ·
        {{ earlier.decision.reason }}
      </p>
    </div>
    <TraceCriteria :rows="earlier.criteria" />
  </section>
</template>
