<script setup lang="ts">
import UButton from "@nuxt/ui/components/Button.vue";
import { computed, onMounted, useTemplateRef } from "vue";
import { featureRequestsRoute } from "../../application/feature-requests";
import type { ReviewWorkspace } from "../../application/feature-requests";
import {
  useRememberWorkspaceOrigin,
  useWorkspaceOriginKey,
  useWorkspaceRouteFocus,
} from "../projects";
import { useMessages, useNavigate } from "../shell";

const { review, focusRequested } = defineProps<{
  readonly review: ReviewWorkspace;
  readonly focusRequested: boolean;
}>();
const text = useMessages()["feature-requests"];
const heading = useTemplateRef<HTMLElement>("heading");
const navigate = useNavigate();
const remember = useRememberWorkspaceOrigin();
const origin = useWorkspaceOriginKey();
const focus = useWorkspaceRouteFocus();
const revision = computed(() => {
  const value = text.revision(review.record.displayId, review.entry.revision);
  return review.run ? value + " · " + review.run.runId : value;
});
const state = computed(() => (review.entry.isCurrent ? review.record.state : review.entry.state));

onMounted(() => {
  const element = heading.value;
  if (!element || origin()) return;
  if (focusRequested || element.ownerDocument.activeElement === element.ownerDocument.body)
    focus(element);
});

async function openRequest(event: MouseEvent) {
  remember(event.currentTarget as HTMLElement);
  const { projectId, id } = review.record;
  if (!(await navigate(featureRequestsRoute(projectId, { requestId: id })))) remember(undefined);
}
</script>

<template>
  <header class="pe-request-header">
    <div class="pe:grid pe:min-w-0 pe:gap-1">
      <h1 ref="heading" tabindex="-1" class="pe:text-2xl pe:font-semibold">
        {{ review.entry.title }}
      </h1>
      <p class="pe-request-row-meta">{{ text.review.title }}</p>
      <p class="pe-request-row-meta">{{ revision }}</p>
      <span class="pe-request-state pe:justify-self-start">{{ text.states[state] }}</span>
    </div>
    <UButton
      type="button"
      variant="outline"
      color="neutral"
      :label="text.review.openRequest"
      data-testid="review-request"
      data-pe-focus-key="review-request"
      @click="openRequest"
    />
  </header>
</template>
