<script setup lang="ts">
import UIcon from "@nuxt/ui/components/Icon.vue";
import { computed, onMounted, watch } from "vue";
import { backlogBoardRoute, pbiBoardStage } from "../../../application/backlog";
import type { BacklogItem, BacklogSnapshot } from "../../../application/backlog";
import { featureRequestsRoute, reviewsRoute } from "../../../application/feature-requests";
import type {
  RequestStageEntry,
  RequestStageProjection,
} from "../../../application/feature-requests";
import type { ProjectId } from "../../../application/projects";
import type { Route } from "../../../application/routes";
import { isCanonicalStoryItem } from "../../../application/story-maps";
import { readOverviewPreparation, tracePbiDestination } from "../../../application/trace";
import { useMessages, useQuery } from "../../shell";
import { useRestoreWorkspacePosition } from "../workspace-position";
import ProjectOverviewLink from "./ProjectOverviewLink.vue";
import ProjectOverviewRanked from "./ProjectOverviewRanked.vue";
import ProjectOverviewStages from "./ProjectOverviewStages.vue";

const { projectId, backlog, stages } = defineProps<{
  readonly projectId: ProjectId;
  readonly backlog: BacklogSnapshot;
  readonly stages: RequestStageProjection;
}>();
const catalog = useMessages();
const text = catalog.projects.overviewDelivery;
const requestText = catalog["feature-requests"];
const restore = useRestoreWorkspacePosition();
const prepare = useQuery(readOverviewPreparation);
const requestsByPbi = computed(() => {
  const byPbi = new Map<string, RequestStageEntry[]>();
  for (const entry of stages.entries) {
    const { pbiId } = entry.record;
    const existing = byPbi.get(pbiId) ?? [];
    existing.push(entry);
    byPbi.set(pbiId, existing);
  }
  return byPbi;
});
const nextPbis = computed(() =>
  backlog.items.filter(
    (item) =>
      item.kind === "UC" &&
      (!item.id || !requestsByPbi.value.has(item.id)) &&
      pbiBoardStage(item) !== "Done",
  ),
);
watch(
  nextPbis,
  (items) => {
    void prepare.run(projectId, items);
  },
  { immediate: true },
);

type Phase = keyof typeof text.statuses;
type Action = {
  readonly id: string;
  readonly title: string;
  readonly record?: string;
  readonly phase: Phase;
  readonly reason?: string;
  readonly destination: Route;
};

const requestPriority = ["review", "blocked", "ready", "factory", "draft"] as const;
const phaseIcons = {
  review: "i-lucide-clipboard-check",
  blocked: "i-lucide-circle-help",
  ready: "i-lucide-clipboard-list",
  factory: "i-lucide-clipboard-list",
  draft: "i-lucide-clipboard-list",
  prep: "i-lucide-list-tree",
  done: "i-lucide-check",
  empty: "i-lucide-list-tree",
} as const satisfies Record<Phase, string>;

function requestPhase(entry: RequestStageEntry) {
  return entry.reviewBlocker ? "blocked" : entry.stage;
}

function blockerReason(entry: RequestStageEntry) {
  if (entry.reviewBlocker === "stale" || entry.blocker === "stale-inputs")
    return text.reasons.stale;
  if (entry.reviewBlocker) return text.reasons.reviewBlocked;
  return entry.blocker
    ? requestText.blockers[entry.blocker]
    : requestText.states[entry.record.state];
}

function pbiRoute(item: BacklogItem) {
  return tracePbiDestination(projectId, item, isCanonicalStoryItem(item) ? item.id : undefined);
}

const requestActions = computed(() =>
  requestPriority.flatMap((phase) =>
    stages.entries
      .filter((entry) => requestPhase(entry) === phase)
      .map((entry): Action => {
        const { id, revision, displayId, title } = entry.record;
        return {
          id,
          phase,
          title,
          record: displayId,
          reason: phase === "blocked" ? blockerReason(entry) : text.reasons[phase],
          destination:
            phase === "review"
              ? reviewsRoute(projectId, { requestId: id, revision })
              : featureRequestsRoute(projectId, {
                  requestId: id,
                  revision,
                  origin: { kind: "overview" },
                  ...(phase === "draft" && { tab: "gates" as const }),
                  ...(phase === "factory" && { tab: "run" as const }),
                }),
        };
      }),
  ),
);

const nextPbiActions = computed(() =>
  nextPbis.value.map((item): Action => {
    const state = prepare.value.value?.get(item.key);
    const reason = state?.reason;
    const label =
      reason === "identity"
        ? catalog.trace.gaps.identity
        : reason === "unavailable"
          ? catalog.trace.unavailable
          : reason
            ? catalog.backlog.pbiGates.reasons[reason]
            : undefined;
    return {
      id: item.key,
      phase: "prep",
      title: item.title,
      ...(item.id && { record: item.id }),
      ...(label && { reason: label }),
      destination: state?.destination ?? pbiRoute(item),
    };
  }),
);

const ready = computed(() => stages.ready && backlog.ready && !stages.failed);
const featured = computed<Action>(() => {
  const next = requestActions.value[0] ?? nextPbiActions.value[0];
  if (next) return next;
  const count = stages.counts.get("done") ?? 0;
  return count
    ? {
        id: "done",
        phase: "done",
        title: text.acceptedCount(count),
        destination: featureRequestsRoute(projectId, { stage: "done" }),
      }
    : { id: "empty", phase: "empty", title: text.none, destination: backlogBoardRoute(projectId) };
});
const tasks = computed(() =>
  [
    ...new Map(
      [...requestActions.value, ...nextPbiActions.value]
        .filter(({ id, reason }) => id !== featured.value.id && reason)
        .map((action) => [action.id, action]),
    ).values(),
  ].slice(0, 5),
);

onMounted(() => restore());
watch([ready, tasks], () => restore("available"), { flush: "post" });
</script>

<template>
  <div class="pe-overview-delivery" data-testid="overview-delivery">
    <p v-if="stages.failed" role="alert">{{ requestText.unavailable }}</p>
    <p v-else-if="!ready" role="status">{{ requestText.loading }}</p>
    <template v-else>
      <section
        class="pe-overview-panel pe-overview-featured"
        :data-phase="featured.phase"
        data-testid="overview-featured"
      >
        <span class="pe-overview-phase-icon"
          ><UIcon :name="phaseIcons[featured.phase]" aria-hidden="true"
        /></span>
        <div>
          <h2>{{ text.statuses[featured.phase] }}</h2>
          <p>{{ featured.record ? `${featured.record} · ${featured.title}` : featured.title }}</p>
        </div>
        <ProjectOverviewLink
          :destination="featured.destination"
          primary
          data-testid="overview-featured-action"
          data-pe-focus-key="overview-featured-action"
          >{{ text.actions[featured.phase] }}</ProjectOverviewLink
        >
      </section>
      <div class="pe-overview-summary">
        <ProjectOverviewStages :project-id="projectId" :counts="stages.counts" />
        <section v-if="tasks.length" data-testid="overview-tasks">
          <header class="pe-overview-section-head">
            <h2>{{ text.tasks }}</h2>
          </header>
          <ul class="pe-overview-panel pe-overview-tasks">
            <li v-for="task in tasks" :key="task.id">
              <ProjectOverviewLink
                :destination="task.destination"
                :data-pe-focus-key="'overview-task-' + task.id"
              >
                <span class="pe-overview-phase-icon"
                  ><UIcon :name="phaseIcons[task.phase]" aria-hidden="true"
                /></span>
                <span
                  ><strong>{{ task.title }}</strong
                  ><small>{{
                    task.record ? `${task.record} · ${task.reason}` : task.reason
                  }}</small></span
                >
                <UIcon name="i-lucide-chevron-right" aria-hidden="true" />
              </ProjectOverviewLink>
            </li>
          </ul>
        </section>
      </div>
      <ProjectOverviewRanked
        :project-id="projectId"
        :backlog="backlog"
        :requests="requestsByPbi"
        :preparation="prepare.value.value"
      />
    </template>
  </div>
</template>
