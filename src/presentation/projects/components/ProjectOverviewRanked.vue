<script setup lang="ts">
import { computed } from "vue";
import { backlogBoardRoute, pbiBoardStage } from "../../../application/backlog";
import type { BacklogSnapshot } from "../../../application/backlog";
import { featureRequestsForPbi } from "../../../application/feature-requests";
import type { RequestStageEntry } from "../../../application/feature-requests";
import type { ProjectId } from "../../../application/projects";
import { isCanonicalStoryItem } from "../../../application/story-maps";
import { tracePbiDestination } from "../../../application/trace";
import type { OverviewPreparation } from "../../../application/trace";
import type { BoardStage } from "../../../domain/backlog";
import { useMessages } from "../../shell";
import ProjectOverviewLink from "./ProjectOverviewLink.vue";

const { projectId, backlog, requests, preparation } = defineProps<{
  readonly projectId: ProjectId;
  readonly backlog: BacklogSnapshot;
  readonly requests: ReadonlyMap<string, readonly RequestStageEntry[]>;
  readonly preparation: OverviewPreparation | undefined;
}>();
const catalog = useMessages();
const text = catalog.projects.overviewDelivery;
const requestText = catalog["feature-requests"];

function deliveryLabel(entry: RequestStageEntry | undefined, stage: BoardStage, key: string) {
  if (entry?.stage === "blocked" || entry?.reviewBlocker) return text.blocked;
  if (entry) return requestText.states[entry.record.state];
  if (stage === "Done") return text.noRequest;
  const prep = preparation?.get(key);
  if (!prep) return text.pending;
  return prep.reason ? text.gaps : text.prepared;
}

const ranked = computed(() => {
  const parents = new Map(backlog.items.map((item) => [item.key, item.title]));
  return backlog.items
    .filter(({ kind }) => kind === "UC")
    .map((item) => {
      const pbiId = isCanonicalStoryItem(item) ? item.id : undefined;
      const links = pbiId ? (requests.get(pbiId) ?? []) : [];
      const handoff = pbiId
        ? featureRequestsForPbi(
            projectId,
            pbiId,
            links.map(({ record }) => record),
          )
        : undefined;
      const stage = pbiBoardStage(item, handoff);
      const parent = item.parent && parents.get(item.parent);
      return {
        key: item.key,
        id: item.id ?? item.key,
        title: item.title,
        stage,
        delivery: deliveryLabel(links[0], stage, item.key),
        meta: [item.id, parent].filter(Boolean).join(" · "),
        priority: item.priority || catalog.backlog.unset,
        route: tracePbiDestination(projectId, item, pbiId),
      };
    });
});
</script>

<template>
  <section v-if="ranked.length" :aria-label="text.work" data-testid="overview-ranked">
    <header class="pe-overview-section-head">
      <h2>{{ text.work }}</h2>
      <ProjectOverviewLink
        :destination="backlogBoardRoute(projectId)"
        data-pe-focus-key="overview-backlog"
      >
        {{ text.actions.empty }}
      </ProjectOverviewLink>
    </header>
    <div class="pe-overview-panel">
      <table class="pe-overview-table" role="table" :aria-label="text.work">
        <thead role="rowgroup">
          <tr role="row">
            <th scope="col">{{ requestText.pbi }}</th>
            <th scope="col">{{ catalog.backlog.priority }}</th>
            <th scope="col">{{ catalog.backlog.title }}</th>
            <th scope="col">{{ text.delivery }}</th>
          </tr>
        </thead>
        <tbody role="rowgroup">
          <tr v-for="row in ranked" :key="row.key" :data-overview-pbi="row.id" role="row">
            <td role="cell">
              <ProjectOverviewLink
                :destination="row.route"
                :data-pe-focus-key="'overview-pbi-' + row.key"
                >{{ row.title }}</ProjectOverviewLink
              >
              <small v-if="row.meta">{{ row.meta }}</small>
            </td>
            <td role="cell" :data-overview-label="catalog.backlog.priority">
              <span class="pe-overview-field-label">{{ catalog.backlog.priority }}</span>
              <span class="pe-overview-badge">{{ row.priority }}</span>
            </td>
            <td role="cell" :data-overview-label="catalog.backlog.title">
              <span class="pe-overview-field-label">{{ catalog.backlog.title }}</span>
              <span class="pe-overview-badge">{{ text.boardStages[row.stage] }}</span>
            </td>
            <td role="cell" :data-overview-label="text.delivery">
              <span class="pe-overview-field-label">{{ text.delivery }}</span>
              <span class="pe-overview-badge">{{ row.delivery }}</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>
