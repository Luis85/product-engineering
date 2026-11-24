<script setup lang="ts">
import UIcon from "@nuxt/ui/components/Icon.vue";
import { computed } from "vue";
import { featureRequestsRoute, reviewsRoute } from "../../application/feature-requests";
import type { FeatureRequest, ReviewWorkspace } from "../../application/feature-requests";
import type { Route } from "../../application/routes";
import type { TraceDelivery } from "../../application/trace";
import { useMessages } from "../shell";
import TraceLink from "./TraceLink.vue";

const { delivery } = defineProps<{ readonly delivery: TraceDelivery | undefined }>();
const catalog = useMessages();
const text = catalog.trace;
const requestText = catalog["feature-requests"];
type Row = {
  readonly key: string;
  readonly icon: string;
  readonly label: string;
  readonly value: string;
  readonly route?: Route | undefined;
  readonly commit?: string | undefined;
  readonly warning?: boolean;
  readonly reason?: string | undefined;
};

function businessLabel(decision: NonNullable<TraceDelivery["decision"]>["state"] | undefined) {
  if (decision === "accepted") return text.accepted;
  if (decision === "changes-requested") return text.changes;
  return text.pending;
}

function requestRow(request: FeatureRequest | undefined): Row {
  return {
    key: "request",
    icon: "i-lucide-clipboard-list",
    label: text.handoff,
    value: request
      ? `${text.revision(request.displayId, request.revision)} · ${requestText.states[request.state]}`
      : text.noRequest,
    route: request && featureRequestsRoute(request.projectId, { requestId: request.id }),
  };
}

function verificationRow(review: ReviewWorkspace | undefined, route: Route | undefined): Row {
  const commit = review?.target?.commit;
  const pullRequest = review?.pullRequest;
  return {
    key: "review",
    icon: "i-lucide-code",
    label: text.verification,
    value: commit ? (pullRequest ? `PR #${pullRequest} · ` : "") : text.pendingCommit,
    route: commit ? route : undefined,
    commit,
    warning: Boolean(commit && review?.baseline?.stale),
  };
}

function decisionRow(decision: TraceDelivery["decision"], route: Route | undefined): Row {
  return {
    key: "decision",
    icon: "i-lucide-clipboard-check",
    label: requestText.review.title,
    value: businessLabel(decision?.state),
    route,
    reason: decision?.reason,
  };
}

const rows = computed(() => {
  const request = delivery?.request;
  const review = delivery?.review;
  const decision = delivery?.decision;
  const route =
    request &&
    reviewsRoute(request.projectId, {
      requestId: request.id,
      revision: request.revision,
    });
  return [
    requestRow(request),
    verificationRow(review, route),
    decisionRow(decision, review?.target || decision ? route : undefined),
  ];
});
</script>

<template>
  <section class="pe-trace-chain" :aria-label="text.delivery" data-testid="trace-delivery">
    <h3>{{ text.delivery }}</h3>
    <ol>
      <li v-for="row in rows" :key="row.key">
        <UIcon :name="row.icon" class="pe-trace-mark" aria-hidden="true" />
        <div>
          <p class="pe-trace-label">{{ row.label }}</p>
          <TraceLink
            v-if="row.route"
            :destination="row.route"
            :data-pe-focus-key="'trace-' + row.key"
            :data-testid="'trace-' + row.key"
          >
            {{ row.value }}<code v-if="row.commit">{{ row.commit }}</code>
          </TraceLink>
          <p v-else>{{ row.value }}</p>
          <p v-if="row.warning" class="pe-trace-warning" data-testid="trace-stale">
            {{ text.stale }}
          </p>
          <p v-if="row.reason" class="pe:whitespace-pre-wrap" data-testid="trace-reason">
            {{ row.reason }}
          </p>
        </div>
      </li>
    </ol>
  </section>
</template>
