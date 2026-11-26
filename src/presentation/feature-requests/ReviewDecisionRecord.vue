<script setup lang="ts">
import { useTemplateRef } from "vue";
import type { ReviewWorkspace } from "../../application/feature-requests";
import { useMessages } from "../shell";

const { review } = defineProps<{ readonly review: ReviewWorkspace }>();
const text = useMessages()["feature-requests"];
const summary = useTemplateRef<HTMLElement>("summary");
function focus() {
  if (!summary.value) return false;
  summary.value.focus({ preventScroll: true });
  return true;
}
defineExpose({ focus });
</script>

<template>
  <div
    v-if="review.entry.decision"
    ref="summary"
    tabindex="-1"
    class="pe:grid pe:gap-1"
    data-testid="review-saved-decision"
  >
    <h3 class="pe:font-semibold">
      {{ text.review.saved }} · {{ text.states[review.entry.decision.decision] }}
    </h3>
    <p>
      {{
        text.review.target(
          text.revision(review.record.displayId, review.entry.revision),
          review.entry.decision.commit,
        )
      }}
    </p>
    <time v-if="review.entry.decision.proof" :datetime="review.entry.decision.proof.decidedAt">
      {{ review.entry.decision.proof.decidedAt }}
    </time>
    <p v-if="review.entry.decision.explanation" class="pe:whitespace-pre-wrap">
      {{ review.entry.decision.explanation }}
    </p>
  </div>
</template>
