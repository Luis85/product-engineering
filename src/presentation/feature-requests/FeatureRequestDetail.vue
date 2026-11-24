<script setup lang="ts">
import UButton from "@nuxt/ui/components/Button.vue";
import { computed, ref, watch } from "vue";
import {
  backlogBoardReturnRoute,
  backlogRoute,
  pbiDetailRoute,
  PROJECT_BACKLOG,
  PROJECT_USE_CASE,
} from "../../application/backlog";
import type { BacklogSnapshot } from "../../application/backlog";
import { featureRequestsRoute, PROJECT_FEATURE_REQUESTS } from "../../application/feature-requests";
import type { FeatureRequest, FeatureRequestOrigin } from "../../application/feature-requests";
import type { Route } from "../../application/routes";
import type { DeliveryStage } from "../../domain/feature-requests";
import { useRememberWorkspaceOrigin } from "../projects";
import { useHistory, useMessages, useNavigate, useRouting } from "../shell";
import FeatureRequestGateDetails from "./FeatureRequestGateDetails.vue";

const { record, backlog, selectedGates, stage, origin } = defineProps<{
  readonly record: FeatureRequest;
  readonly backlog: BacklogSnapshot;
  readonly selectedGates: boolean;
  readonly stage: DeliveryStage | undefined;
  readonly origin: FeatureRequestOrigin | undefined;
}>();
const text = useMessages()["feature-requests"];
const { history } = useRouting();
const { back } = useHistory();
const navigate = useNavigate();
const remember = useRememberWorkspaceOrigin();
const expanded = ref(selectedGates);
watch(
  () => selectedGates,
  (selected) => {
    expanded.value = selected;
  },
);
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
};
const previous = computed(() => {
  const route = history.value.back.at(-1);
  if (!route || !("projectId" in route) || route.projectId !== record.projectId) return undefined;
  return returnMatches[origin?.kind ?? "register"](route) ? route : undefined;
});
const returnLabels = { board: text.boardBack, list: text.listBack, pbi: text.pbiBack };
const returnLabel = computed(() => (origin ? returnLabels[origin.kind] : text.back));

function close() {
  if (previous.value) return back();
  const { projectId, pbiId, id } = record;
  if (origin?.kind === "board")
    return navigate(backlogBoardReturnRoute(projectId, { context: origin.context, requestId: id }));
  if (origin?.kind === "list") return navigate(backlogRoute(projectId));
  if (origin?.kind === "pbi") return navigate(pbiDetailRoute(projectId, pbiId, "links"));
  return navigate(featureRequestsRoute(projectId, stage ? { stage } : {}));
}

async function openPbi(event: MouseEvent) {
  remember(event.currentTarget as HTMLElement);
  if (!(await navigate(pbiDetailRoute(record.projectId, record.pbiId)))) remember(undefined);
}
</script>

<template>
  <section class="pe-feature-requests" data-testid="request-detail">
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
        text.revision(record.displayId, record.revision)
      }}</span>
      <span class="pe-request-state">{{ text.states[record.state] }}</span>
      <span v-if="record.runId" class="pe:text-sm pe:font-mono">{{ record.runId }}</span>
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
        <dd class="pe:whitespace-pre-wrap" data-testid="request-scope">{{ record.scope }}</dd>
      </div>
    </dl>
    <p v-if="record.blocker" role="status">{{ text.blockers[record.blocker] }}</p>
    <UButton
      type="button"
      variant="soft"
      color="neutral"
      class="pe:justify-self-start"
      :label="text.gates"
      :aria-expanded="expanded"
      data-testid="request-toggle-gates"
      @click="expanded = !expanded"
    />
    <FeatureRequestGateDetails v-if="expanded" :record="record" :backlog="backlog" />
  </section>
</template>
