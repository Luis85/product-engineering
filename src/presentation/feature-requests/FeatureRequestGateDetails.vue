<script setup lang="ts">
import UButton from "@nuxt/ui/components/Button.vue";
import { computed, watch } from "vue";
import { pbiDetailRoute } from "../../application/backlog";
import type { PbiPreparationGap, PbiTab } from "../../application/backlog";
import {
  confirmRequestReady,
  featureRequestNoteOrigin,
  releaseFeatureRequest,
} from "../../application/feature-requests";
import type {
  FeatureRequest,
  FeatureRequestRevision,
  RequestPackagePreview,
} from "../../application/feature-requests";
import { knowledgeDetailRoute, projectKnowledgeRoute } from "../../application/knowledge";
import { projectAdministrationRoute } from "../../application/projects";
import { useRememberWorkspaceOrigin, useRestoreWorkspacePosition } from "../projects";
import { ErrorNotice, useCommand, useMessages, useNavigate } from "../shell";
import FeatureRequestGatePhase from "./FeatureRequestGatePhase.vue";

const { record, revision, preview, pending } = defineProps<{
  readonly record: FeatureRequest;
  readonly revision: FeatureRequestRevision | undefined;
  readonly preview: RequestPackagePreview | undefined;
  readonly pending: boolean;
}>();
const messages = useMessages();
const text = messages["feature-requests"];
const draft = computed(() => revision?.isCurrent && record.state === "draft");
const current = computed(() => (draft.value ? preview?.gates : undefined));
const evidence = computed(() => ({
  ready: draft.value ? current.value?.ready : revision?.readyGates,
  done: draft.value ? current.value?.done : revision?.doneGates,
}));
const {
  pending: confirming,
  message: confirmationError,
  run: confirm,
} = useCommand(confirmRequestReady);
const {
  pending: releasing,
  message: releaseError,
  run: release,
} = useCommand(releaseFeatureRequest);
const busy = computed(() => confirming.value || releasing.value || pending);
const error = computed(() => releaseError.value ?? confirmationError.value);
const manual = computed(
  () =>
    new Set<string>(
      current.value?.rules?.ready.filter(({ type }) => type === "manual").map(({ id }) => id),
    ),
);
const noManual = new Set<string>();
const navigate = useNavigate();
const remember = useRememberWorkspaceOrigin();
const restore = useRestoreWorkspacePosition();
const gaps = computed(() =>
  (current.value?.gaps ?? []).map((gap, index) => ({
    gap,
    key: gap.reason + (gap.record?.id ?? ""),
    test: index === 0 ? "request-prepare" : "request-repair",
    label: preparationLabel(gap),
  })),
);
const notice = computed(() => {
  if (pending) return text.loadingGates;
  return current.value?.rulesAvailable === false ? text.gatesUnavailable : undefined;
});
const preparationLabel = ({ reason, record: input }: PbiPreparationGap) =>
  messages.backlog.pbiGates.reasons[reason] + (input ? ` · ${input.displayId}` : "");
const tabs: Partial<Record<PbiPreparationGap["reason"], PbiTab>> = {
  prd: "edit",
  research: "edit",
  adr: "edit",
  criteria: "criteria",
  scenario: "criteria",
  gitPending: "git",
  gitUnavailable: "git",
};

async function toggle(id: string, checked: boolean) {
  if (!current.value?.rules) return;
  await confirm(record, id, current.value.rules.version, checked);
}

const releaseDisabled = computed(() => !preview?.ready || busy.value);
function publish() {
  if (preview) return release(record, preview.basis);
}

async function prepare(gap: PbiPreparationGap, event: MouseEvent) {
  remember(event.currentTarget as HTMLElement);
  const target = gap.record
    ? knowledgeDetailRoute(record.projectId, gap.record.id, featureRequestNoteOrigin(record.id))
    : gap.reason === "repository"
      ? projectAdministrationRoute(record.projectId, "project")
      : gap.reason === "vision"
        ? projectKnowledgeRoute(record.projectId)
        : pbiDetailRoute(record.projectId, record.pbiId, tabs[gap.reason] ?? "usecase");
  if (!(await navigate(target))) remember(undefined);
}

watch(gaps, () => restore("available"), { flush: "post" });
</script>

<template>
  <section class="pe-request-gates" :aria-busy="pending" data-testid="request-gates">
    <h2 class="pe:font-semibold">{{ text.gates }}</h2>
    <p v-if="notice" role="status">{{ notice }}</p>
    <ErrorNotice v-if="error" :message="error" />
    <FeatureRequestGatePhase
      phase="ready"
      :gates="evidence.ready"
      :manual="manual"
      :pending="busy"
      @toggle="toggle"
    >
      <ul class="pe:grid pe:gap-1">
        <li v-for="{ gap, key, test, label } in gaps" :key="key">
          <UButton
            type="button"
            variant="link"
            class="pe:p-0 pe:text-start pe:whitespace-normal pe:wrap-anywhere"
            :data-testid="test"
            :data-pe-focus-key="'request-prepare-' + key"
            :label="label"
            @click="prepare(gap, $event)"
          />
        </li>
      </ul>
    </FeatureRequestGatePhase>
    <FeatureRequestGatePhase
      phase="done"
      :gates="evidence.done"
      :manual="noManual"
      :pending="busy"
    />
    <UButton
      v-if="draft"
      type="button"
      class="pe:justify-self-start"
      :label="text.release"
      data-testid="request-release"
      :disabled="releaseDisabled"
      :loading="releasing"
      @click="publish"
    />
  </section>
</template>
