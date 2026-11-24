<script setup lang="ts">
import type { ReviewWorkspace } from "../../application/feature-requests";
import { useMessages } from "../shell";

const { review, editable, checking } = defineProps<{
  readonly review: ReviewWorkspace;
  readonly editable: boolean;
  readonly checking: boolean;
}>();
const emit = defineEmits<{ toggle: [id: string, event: Event, confirmed: boolean] }>();
const text = useMessages()["feature-requests"];
</script>

<template>
  <section class="pe-request-panel" data-testid="review-criteria">
    <div class="pe-request-panel-heading">
      <h2>{{ text.criteria }}</h2>
      <span class="pe:text-muted" aria-live="polite" data-testid="review-confirmed">
        {{ text.review.confirmed(review.confirmed, review.criteria.length) }}
      </span>
    </div>
    <p v-if="!review.criteria.length">{{ text.review.noCriteria }}</p>
    <label v-for="criterion in review.criteria" :key="criterion.id" class="pe-request-gate-row">
      <input
        type="checkbox"
        :checked="criterion.confirmed"
        :disabled="!editable"
        :aria-disabled="checking"
        data-testid="review-criterion-check"
        :data-criterion-id="criterion.id"
        @change="emit('toggle', criterion.id, $event, criterion.confirmed)"
      />
      <span>
        <strong>{{ criterion.text }}</strong>
        <small class="pe:block pe:text-muted"
          >{{ criterion.id }} · {{ criterion.scenario_id }}</small
        >
      </span>
    </label>
  </section>
</template>
