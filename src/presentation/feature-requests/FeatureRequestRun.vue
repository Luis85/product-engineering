<script setup lang="ts">
import UButton from "@nuxt/ui/components/Button.vue";
import { computed } from "vue";
import {
  canPrepareFollowup,
  dispatchFeatureRequest,
  prepareRequestFollowup,
  replayFactoryEvent,
  retryFeatureRequest,
  simulateFactoryEvent,
} from "../../application/feature-requests";
import type {
  FactoryFixtureAction,
  FeatureRequest,
  FeatureRequestRevision,
} from "../../application/feature-requests";
import { ErrorNotice, useCommand, useMessages } from "../shell";
import FeatureRequestClarification from "./FeatureRequestClarification.vue";
import FeatureRequestRunHistory from "./FeatureRequestRunHistory.vue";
import FeatureRequestRunSummary from "./FeatureRequestRunSummary.vue";

const { record, revision, stale } = defineProps<{
  readonly record: FeatureRequest;
  readonly revision: FeatureRequestRevision | undefined;
  readonly stale: boolean;
}>();
const text = useMessages()["feature-requests"];
const dispatch = useCommand(dispatchFeatureRequest);
const retry = useCommand(retryFeatureRequest);
const fixture = useCommand(simulateFactoryEvent);
const replay = useCommand(replayFactoryEvent);
const {
  pending: following,
  message: followError,
  run: follow,
} = useCommand(prepareRequestFollowup);
const pending = computed(
  () =>
    dispatch.pending.value ||
    retry.pending.value ||
    fixture.pending.value ||
    following.value ||
    replay.pending.value,
);
const error = computed(
  () =>
    dispatch.message.value ??
    retry.message.value ??
    fixture.message.value ??
    followError.value ??
    replay.message.value,
);
const available = computed<readonly FactoryFixtureAction[]>(() => {
  if (!revision?.isCurrent || !revision.run) return [];
  if (record.state === "queued") return ["pickup"];
  if (record.state === "running") return ["question", "fail", "verify"];
  return [];
});
const lastEvent = computed(() => revision?.events.at(-1));
const replayVersion = computed(() =>
  lastEvent.value && ["picked-up", "question", "failed", "verified"].includes(lastEvent.value.kind)
    ? revision?.revision
    : undefined,
);
const question = computed(() =>
  revision?.isCurrent && record.state === "clarification" && lastEvent.value?.kind === "question"
    ? lastEvent.value
    : undefined,
);
const worker = computed(() =>
  lastEvent.value?.kind === "picked-up" ? lastEvent.value.worker : undefined,
);
const events = computed(() => revision?.events ?? []);
type Action = { id: string; label: string; blocked: boolean; primary: boolean; run: () => unknown };
const controls = computed<Action[]>(() => {
  if (!revision?.isCurrent) return [];
  const blocked = stale || pending.value;
  const actions: Action[] = available.value.map((action) => ({
    id: "fixture-" + action,
    label: text.factory[action],
    blocked: pending.value,
    primary: false,
    run: () => fixture.run(record, action),
  }));
  if (record.state === "released" && revision.package?.checksum)
    actions.push({
      id: "dispatch",
      label: text.factory.send,
      blocked,
      primary: true,
      run: () => dispatch.run(record),
    });
  if (record.state === "failed")
    actions.push({
      id: "retry",
      label: text.factory.retry,
      blocked,
      primary: true,
      run: () => retry.run(record),
    });
  if (canPrepareFollowup(record.state))
    actions.push({
      id: "followup",
      label: text.factory.followup,
      blocked: pending.value,
      primary: false,
      run: () => follow(record),
    });
  return actions;
});
</script>

<template>
  <section class="pe-request-panel" data-testid="request-run">
    <h2>{{ text.run }}</h2>
    <FeatureRequestRunSummary :revision="revision" />
    <p v-if="worker">{{ worker }}</p>
    <ErrorNotice v-if="error" :message="error" />
    <div v-if="controls.length" class="pe:flex pe:flex-wrap pe:items-start pe:gap-2">
      <UButton
        v-for="action in controls"
        :key="action.id"
        type="button"
        :variant="action.primary ? 'solid' : 'soft'"
        :label="action.label"
        :disabled="action.blocked"
        :data-testid="'request-' + action.id"
        @click="action.run()"
      />
    </div>
    <UButton
      v-if="replayVersion"
      type="button"
      variant="ghost"
      class="pe:justify-self-start"
      :label="text.factory.repeat"
      :disabled="pending"
      data-testid="request-replay-event"
      @click="replay.run(record, replayVersion)"
    />
    <FeatureRequestClarification v-if="question" :record="record" :question="question" />
    <FeatureRequestRunHistory :events="events" />
  </section>
</template>
