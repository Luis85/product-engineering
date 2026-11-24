<script setup lang="ts">
import UButton from "@nuxt/ui/components/Button.vue";
import { computed, shallowRef, useTemplateRef, watch } from "vue";
import {
  acceptReview,
  canPrepareFollowup,
  confirmReviewCheck,
  featureRequestsRoute,
  prepareRequestFollowup,
  requestGateProgress,
} from "../../application/feature-requests";
import type { ReviewTarget, ReviewWorkspace } from "../../application/feature-requests";
import { ErrorNotice, useCommand, useMessages, useNavigate } from "../shell";
import FeatureRequestScopeEvidence from "./FeatureRequestScopeEvidence.vue";
import ReviewChangeDialog from "./ReviewChangeDialog.vue";
import ReviewCriteria from "./ReviewCriteria.vue";
import ReviewDecisionRecord from "./ReviewDecisionRecord.vue";
import ReviewDoneGates from "./ReviewDoneGates.vue";
import ReviewHeading from "./ReviewHeading.vue";
import ReviewProof from "./ReviewProof.vue";

const { review, focusRequested } = defineProps<{
  readonly review: ReviewWorkspace;
  readonly focusRequested: boolean;
}>();
const emit = defineEmits<{ refresh: [] }>();
const messages = useMessages();
const text = messages["feature-requests"];
const labels = text.review;
const navigate = useNavigate();
const { run: check, pending: checking, message: checkError } = useCommand(confirmReviewCheck);
const { run: accept, pending: accepting, message: acceptError } = useCommand(acceptReview);
const {
  run: prepare,
  pending: preparing,
  message: followError,
} = useCommand(prepareRequestFollowup);
const targetForDialog = shallowRef<ReviewTarget>();
const dialogDescription = shallowRef("");
const savedPresentation =
  useTemplateRef<InstanceType<typeof ReviewDecisionRecord>>("savedDecision");
let changeControl: HTMLElement | undefined;
let focusDecision = false;
const editable = computed(() => Boolean(review.target && !review.blocker));
const done = computed(() => requestGateProgress(review.gates));
const payload = computed(() => review.entry.package?.package);
const missingDoneDefinitions = computed(() => payload.value?.definitions === undefined);
const needsFollowup = computed(() => editable.value && missingDoneDefinitions.value);
const nfrs = computed(() => payload.value?.nfrs);
const domain = computed(() => payload.value?.domain);
const stale = computed(() => review.baseline?.stale);
const scopeChanged = computed(() => review.baseline?.scopeChanged);
const error = computed(() => checkError.value ?? acceptError.value ?? followError.value);
const showActions = computed(() => review.entry.isCurrent && review.record.state === "review");
const warning = computed(() =>
  review.blocker && !review.entry.decision ? labels.blockers[review.blocker] : undefined,
);
const canAccept = computed(
  () => editable.value && !missingDoneDefinitions.value && done.value?.met === done.value?.total,
);
const busy = computed(() => checking.value || accepting.value);
const acceptanceHint = computed(() => {
  if (!editable.value || canAccept.value) return undefined;
  if (needsFollowup.value) return labels.missingDoneDefinitions;
  return review.confirmed < review.criteria.length ? labels.finishCriteria : labels.finishDone;
});
const doneTitle = computed(() =>
  done.value
    ? `${text.gatePhases.done} · ${text.gateCount(done.value.met, done.value.total)}`
    : text.gatePhases.done,
);
const target = computed(() =>
  labels.target(
    text.revision(review.record.displayId, review.entry.revision),
    review.testedCommit ?? text.unknown,
  ),
);
const canFollow = computed(
  () =>
    review.entry.isCurrent &&
    canPrepareFollowup(review.record.state) &&
    (Boolean(review.entry.decision) ||
      review.record.state === "changes-requested" ||
      review.baseline?.stale ||
      needsFollowup.value),
);

watch(
  () => review.entry.decision,
  (decision) => {
    if (decision && focusDecision) {
      savedPresentation.value?.focus();
      focusDecision = false;
    }
  },
  { flush: "post" },
);

async function toggle(kind: "criteria" | "manual", id: string, event: Event, original: boolean) {
  const input = event.currentTarget as HTMLInputElement;
  const value = input.checked;
  input.checked = original;
  if (editable.value && review.target && !checking.value && !accepting.value) {
    await check(review.target, kind, id, value);
    emit("refresh");
  }
}

async function acceptDelivery() {
  if (!canAccept.value || !review.target) return;
  focusDecision = (await accept(review.target))._tag === "success";
  emit("refresh");
}

function openChange(event: MouseEvent) {
  if (!editable.value || !review.target) return;
  changeControl = event.currentTarget as HTMLElement;
  dialogDescription.value = target.value;
  targetForDialog.value = review.target;
}

function restoreAfterChange(saved: boolean) {
  if (saved) {
    if (!savedPresentation.value?.focus()) focusDecision = true;
  } else {
    changeControl?.focus({ preventScroll: true });
  }
}

function currentRequestRoute() {
  return featureRequestsRoute(review.record.projectId, { requestId: review.record.id });
}

async function followUp() {
  const outcome = await prepare(review.record);
  if (outcome._tag === "success") await navigate(currentRequestRoute());
  else emit("refresh");
}
</script>

<template>
  <ReviewHeading :review="review" :focus-requested="focusRequested" />
  <p v-if="stale" class="pe-review-stale" role="status" data-testid="review-stale">
    {{ text.reviews.stale }} · {{ labels.blockers.stale }}
  </p>
  <div class="pe-review-proof-and-criteria">
    <ReviewProof :review="review" />
    <ReviewCriteria
      :review="review"
      :editable="editable"
      :checking="checking"
      @toggle="(id, event, original) => toggle('criteria', id, event, original)"
    />
  </div>
  <p v-if="scopeChanged" role="status">{{ text.scopeChanged }}</p>
  <FeatureRequestScopeEvidence :nfrs="nfrs" :domain="domain" />
  <section class="pe-request-panel" data-testid="review-done">
    <h2>{{ doneTitle }}</h2>
    <ReviewDoneGates
      :review="review"
      :editable="editable"
      :checking="checking"
      @toggle="(id, event, original) => toggle('manual', id, event, original)"
    />
    <ErrorNotice v-if="error" :message="error" />
    <p v-if="warning" role="status" data-testid="review-blocker">
      {{ warning }}
    </p>
    <template v-if="showActions">
      <p class="pe:text-muted">{{ target }}</p>
      <p v-if="acceptanceHint" role="status">{{ acceptanceHint }}</p>
      <div class="pe-note-actions">
        <UButton
          type="button"
          :label="labels.accept"
          data-testid="review-accept"
          :disabled="!canAccept || busy"
          @click="acceptDelivery"
        />
        <UButton
          type="button"
          :label="labels.requestChange"
          data-testid="review-change"
          variant="outline"
          color="neutral"
          :disabled="!editable || busy"
          @click="openChange"
        />
      </div>
    </template>
    <ReviewDecisionRecord ref="savedDecision" :review="review" />
    <UButton
      v-if="canFollow"
      type="button"
      class="pe:justify-self-start"
      :label="text.factory.followup"
      :loading="preparing"
      data-testid="review-followup"
      @click="followUp"
    />
  </section>
  <ReviewChangeDialog
    :target="targetForDialog"
    :description="dialogDescription"
    @dismiss="targetForDialog = undefined"
    @closed="restoreAfterChange"
    @refresh="emit('refresh')"
  />
</template>
