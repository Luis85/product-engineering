<script setup lang="ts">
import UButton from "@nuxt/ui/components/Button.vue";
import { computed, nextTick, ref, shallowRef, watch } from "vue";
import {
  backlogBoardReturnRoute,
  backlogRoute,
  pbiDetailRoute,
  PROJECT_BACKLOG,
  PROJECT_USE_CASE,
} from "../../application/backlog";
import type { BacklogSnapshot } from "../../application/backlog";
import {
  featureRequestRevision,
  featureRequestRevisions,
  featureRequestsRoute,
  PROJECT_FEATURE_REQUESTS,
  PROJECT_REVIEWS,
  readFeatureRequestBaseline,
  readRequestPackagePreview,
  requestGateProgress,
  requestInputChanges,
} from "../../application/feature-requests";
import { PROJECT_OVERVIEW, projectOverviewRoute } from "../../application/projects";
import type {
  FeatureRequest,
  FeatureRequestOrigin,
  RequestPackagePreview,
} from "../../application/feature-requests";
import type { Route } from "../../application/routes";
import type { DeliveryStage } from "../../domain/feature-requests";
import { useRememberWorkspaceOrigin, useWorkspaceOriginKey } from "../projects";
import {
  ErrorNotice,
  useAsyncStream,
  useHistory,
  useMessages,
  useNavigate,
  useQuery,
  useRouting,
} from "../shell";
import FeatureRequestGateDetails from "./FeatureRequestGateDetails.vue";
import FeatureRequestEvidence from "./FeatureRequestEvidence.vue";
import FeatureRequestHistory from "./FeatureRequestHistory.vue";
import FeatureRequestPackage from "./FeatureRequestPackage.vue";
import FeatureRequestRun from "./FeatureRequestRun.vue";
import FeatureRequestScope from "./FeatureRequestScope.vue";
import FeatureRequestTabs from "./FeatureRequestTabs.vue";
import { useRequestDetailState } from "./request-detail-state";

const { record, backlog, selectedTab, selectedRevision, stage, origin } = defineProps<{
  readonly record: FeatureRequest;
  readonly backlog: BacklogSnapshot;
  readonly selectedTab: "gates" | "run" | undefined;
  readonly selectedRevision: number | undefined;
  readonly stage: DeliveryStage | undefined;
  readonly origin: FeatureRequestOrigin | undefined;
}>();
const catalog = useMessages();
const text = catalog["feature-requests"];
const { history } = useRouting();
const { back } = useHistory();
const navigate = useNavigate();
const remember = useRememberWorkspaceOrigin();
const restoredOrigin = useWorkspaceOriginKey();
const { tab, historicalRevision } = useRequestDetailState(record);
const panel = ref<HTMLElement>();
const live = useQuery(readRequestPackagePreview);
const baseline = useQuery(readFeatureRequestBaseline);
const settledPreview = shallowRef<RequestPackagePreview>();
const changes = useAsyncStream<symbol | undefined, never>(
  undefined,
  requestInputChanges(record.projectId, record.path),
);
const current = computed(() =>
  featureRequestRevision(record, historicalRevision.value ?? record.revision),
);
const checksum = computed(
  () => featureRequestRevision(record, record.revision)?.package?.checksum?.value,
);
const historyNumbers = computed(() => featureRequestRevisions(record));
const draft = computed(() => current.value?.isCurrent && record.state === "draft");
const preview = computed(() => {
  const settled = settledPreview.value;
  if (draft.value && settled?.package.request.revision === record.revision) return settled;
  return undefined;
});
const payload = computed(() =>
  draft.value ? preview.value?.package : current.value?.package?.package,
);
const scope = computed(() => current.value?.scope ?? record.scope);
const activeRevision = computed(() => current.value?.revision ?? record.revision);
const status = computed(() => current.value?.state ?? record.state);
const activeRun = computed(() => current.value?.runId);
const exportedPackage = computed(() => current.value?.exportJson);
const phaseSummary = computed(() => {
  const phase = draft.value ? "ready" : "done";
  const count = requestGateProgress(
    draft.value ? preview.value?.gates.ready : current.value?.doneGates,
  );
  return count && `${text.gatePhases[phase]} · ${text.gateCount(count.met, count.total)}`;
});
const liveError = computed(() => (draft.value ? live.message.value : baseline.message.value));
const currentBaseline = computed(() =>
  current.value?.isCurrent && checksum.value ? baseline.value.value : undefined,
);
const blocker = computed(() =>
  current.value?.isCurrent
    ? (record.blocker ?? (currentBaseline.value?.stale ? "stale-inputs" : undefined))
    : undefined,
);
const warning = computed(() => {
  if (current.value?.invalidPackage)
    return {
      notice: text.invalidPackage,
      role: "alert",
      test: "request-package-integrity",
    } as const;
  if (blocker.value)
    return { notice: text.blockers[blocker.value], role: "status", test: "request-stale" } as const;
  return undefined;
});
const scopesChanged = computed(() => !draft.value && currentBaseline.value?.scopeChanged);
const checkingBaseline = computed(() =>
  Boolean(currentBaseline.value?.stale || baseline.pending.value),
);
const checkingReadiness = computed(() =>
  Boolean(draft.value && (live.pending.value || live.message.value)),
);
async function refreshDraft(recordToRead: FeatureRequest) {
  const result = await live.run(recordToRead);
  if (result._tag === "success") settledPreview.value = result.value;
}
watch(
  () => selectedTab,
  (selected) => {
    if (selected && !restoredOrigin()?.startsWith("request-")) tab.value = selected;
  },
  { immediate: true },
);
watch(
  [() => record, () => backlog.ready],
  ([value]) => {
    if (value.state === "draft") void refreshDraft(value);
  },
  { immediate: true },
);
watch(
  [checksum, () => backlog.ready],
  ([value]) => {
    if (value) void baseline.run(record);
  },
  { immediate: true },
);
watch(changes, () => {
  if (record.state === "draft") void refreshDraft(record);
  else if (checksum.value) void baseline.run(record);
});
watch(
  [() => record.revision, () => selectedRevision],
  ([revision, selection], previous) => {
    if (selection !== undefined || previous.length > 0) {
      historicalRevision.value = selection === revision ? undefined : selection;
      tab.value = selectedTab ?? "package";
    }
    settledPreview.value = undefined;
  },
  { immediate: true },
);

async function showRevision(number?: number) {
  historicalRevision.value = number;
  tab.value = "package";
  await nextTick();
  panel.value?.querySelector<HTMLElement>("h1")?.focus();
}
const pbiAvailable = computed(() =>
  backlog.items.some(
    ({ id, kind, adopted, conflict }) =>
      id === record.pbiId && kind === "UC" && adopted && !conflict,
  ),
);
const returnMatches = {
  board: (route: Route) => route.name === PROJECT_BACKLOG && (!route.tab || route.tab === "board"),
  list: (route: Route) => route.name === PROJECT_BACKLOG && route.tab === "list",
  pbi: (route: Route) => route.name === PROJECT_USE_CASE && route.pbiId === record.pbiId,
  register: (route: Route) => route.name === PROJECT_FEATURE_REQUESTS && !route.requestId,
  review: (route: Route) =>
    route.name === PROJECT_REVIEWS && route.selection?.requestId === record.id,
  overview: (route: Route) => route.name === PROJECT_OVERVIEW,
};
const previous = computed(() => {
  const route = history.value.back.at(-1);
  if (!route || !("projectId" in route) || route.projectId !== record.projectId) return undefined;
  const kind = route.name === PROJECT_REVIEWS ? "review" : (origin?.kind ?? "register");
  return returnMatches[kind](route) ? route : undefined;
});
const returnLabels = {
  board: text.boardBack,
  list: text.listBack,
  pbi: text.pbiBack,
  overview: catalog.projects.overview,
};
const returnLabel = computed(() => {
  if (previous.value?.name === PROJECT_REVIEWS) return text.review.back;
  return origin ? returnLabels[origin.kind] : text.back;
});

function fallback() {
  const { projectId, pbiId, id } = record;
  switch (origin?.kind) {
    case "board":
      return backlogBoardReturnRoute(projectId, { context: origin.context, requestId: id });
    case "list":
      return backlogRoute(projectId);
    case "pbi":
      return pbiDetailRoute(projectId, pbiId, "links");
    case "overview":
      return projectOverviewRoute(projectId);
    case undefined:
      return featureRequestsRoute(projectId, stage ? { stage } : {});
  }
}

function close() {
  return previous.value ? back() : navigate(fallback());
}

async function openPbi(event: MouseEvent) {
  remember(event.currentTarget as HTMLElement);
  if (!(await navigate(pbiDetailRoute(record.projectId, record.pbiId)))) remember(undefined);
}
</script>

<template>
  <section ref="panel" class="pe-feature-requests" data-testid="request-detail">
    <UButton
      type="button"
      variant="link"
      color="neutral"
      icon="i-lucide-arrow-left"
      :label="returnLabel"
      data-testid="request-return"
      class="pe:justify-self-start pe:p-0"
      @click="close"
    />
    <h1 tabindex="-1" class="pe:wrap-anywhere pe:text-2xl pe:font-semibold">{{ record.title }}</h1>
    <div class="pe:flex pe:flex-wrap pe:items-center pe:gap-2">
      <span class="pe:text-sm pe:text-muted">{{
        text.revision(record.displayId, activeRevision)
      }}</span>
      <span class="pe-request-state" data-testid="request-state">{{ text.states[status] }}</span>
      <span v-if="phaseSummary" class="pe-request-state">{{ phaseSummary }}</span>
      <span v-if="activeRun" class="pe:text-sm pe:font-mono">{{ activeRun }}</span>
    </div>
    <dl class="pe-request-detail-fields">
      <div>
        <dt>{{ text.pbi }}</dt>
        <dd>
          <UButton
            v-if="pbiAvailable"
            type="button"
            variant="link"
            class="pe:p-0"
            data-testid="request-detail-pbi"
            data-pe-focus-key="request-detail-pbi"
            :label="record.pbiId"
            @click="openPbi"
          />
          <span v-else
            >{{ record.pbiId
            }}<template v-if="backlog.ready"> · {{ text.unavailablePbi }}</template></span
          >
        </dd>
      </div>
      <div>
        <dt>{{ text.scope }}</dt>
        <dd class="pe:whitespace-pre-wrap" data-testid="request-scope">{{ scope }}</dd>
      </div>
    </dl>
    <FeatureRequestScope v-if="draft" :record="record" />
    <ErrorNotice v-if="liveError" :message="liveError" />
    <p v-if="warning" :role="warning.role" :data-testid="warning.test">{{ warning.notice }}</p>
    <p v-if="scopesChanged" role="status" data-testid="request-scope-advisory">
      {{ text.scopeChanged }}
    </p>
    <FeatureRequestTabs :active="tab" @select="tab = $event">
      <template #package>
        <FeatureRequestPackage
          :record="record"
          :payload="payload"
          :draft="Boolean(draft)"
          :export-json="exportedPackage"
        />
      </template>
      <template #gates>
        <FeatureRequestGateDetails
          :record="record"
          :revision="current"
          :preview="preview"
          :pending="checkingReadiness"
        />
      </template>
      <template #run>
        <FeatureRequestRun :record="record" :revision="current" :stale="checkingBaseline" />
      </template>
      <template #evidence>
        <FeatureRequestEvidence :revision="current" />
      </template>
    </FeatureRequestTabs>
    <FeatureRequestHistory
      :revisions="historyNumbers"
      :display-id="record.displayId"
      :selected="historicalRevision"
      @select="showRevision"
    />
  </section>
</template>
