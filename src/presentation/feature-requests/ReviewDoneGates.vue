<script setup lang="ts">
import { computed } from "vue";
import type { ReviewWorkspace } from "../../application/feature-requests";
import type { ProjectBaseCheck } from "../../domain/projects";
import { useMessages } from "../shell";

const { review, editable, checking } = defineProps<{
  readonly review: ReviewWorkspace;
  readonly editable: boolean;
  readonly checking: boolean;
}>();
const emit = defineEmits<{ toggle: [id: string, event: Event, confirmed: boolean] }>();
const messages = useMessages();
const text = messages["feature-requests"];

const rows = computed(() =>
  review.gates.map(({ id, title, status }) => ({
    id,
    title: title ?? messages.projects.definitions.baseChecks[id as ProjectBaseCheck] ?? id,
    status,
    manual: review.manualIds.some((manualId) => manualId === id),
    work: review.workByGate[id] ?? [],
  })),
);

type WorkItem = NonNullable<ReviewWorkspace["work"]>[number];
function detail({ title, state, issue }: WorkItem) {
  const result = issue ? text.review.workIssue[issue] : state;
  return [title, result].filter(Boolean).join(" · ");
}
</script>

<template>
  <ul class="pe:grid pe:gap-2">
    <li v-for="row in rows" :key="row.id" :data-review-gate="row.id" class="pe-request-gate-row">
      <label v-if="row.manual" class="pe-request-gate-row">
        <input
          type="checkbox"
          :checked="row.status === 'passed'"
          :disabled="!editable"
          :aria-disabled="checking"
          data-testid="review-manual-check"
          @change="emit('toggle', row.id, $event, row.status === 'passed')"
        />
        {{ row.title }}
      </label>
      <span v-else>{{ row.title }}</span>
      <span class="pe-request-state">{{ text.gateStatus[row.status] }}</span>
      <ul v-if="row.work.length" class="pe-review-work-items">
        <li v-for="item in row.work" :key="item.id">
          <strong>{{ item.id }}</strong><span v-if="detail(item)"> · {{ detail(item) }}</span>
        </li>
      </ul>
    </li>
  </ul>
</template>
