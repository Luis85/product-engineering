<script setup lang="ts">
import UButton from "@nuxt/ui/components/Button.vue";
import { computed } from "vue";
import { pbiDetailRoute } from "../../application/backlog";
import type { BacklogSnapshot } from "../../application/backlog";
import { featureRequestsRoute } from "../../application/feature-requests";
import type { FeatureRequest } from "../../application/feature-requests";
import type { DeliveryStage } from "../../domain/feature-requests";
import { useRememberWorkspaceOrigin } from "../projects";
import { useMessages, useNavigate } from "../shell";
import { useRequestGates } from "./request-gates";

const { record, stage, backlog } = defineProps<{
  readonly record: FeatureRequest;
  readonly stage: DeliveryStage | undefined;
  readonly backlog: BacklogSnapshot;
}>();
const text = useMessages()["feature-requests"];
const { label: gates } = useRequestGates(
  () => record,
  () => backlog,
);
const navigate = useNavigate();
const remember = useRememberWorkspaceOrigin();
const pbi = computed(() =>
  backlog.items.find(
    ({ id, adopted, conflict, kind }) =>
      id === record.pbiId && adopted && !conflict && kind === "UC",
  ),
);

async function open(event: MouseEvent, target: "request" | "gates" | "pbi") {
  const route =
    target === "pbi"
      ? pbiDetailRoute(record.projectId, record.pbiId)
      : featureRequestsRoute(record.projectId, {
          requestId: record.id,
          ...(stage && { stage }),
          ...(target === "gates" && { tab: "gates" }),
        });
  remember(event.currentTarget as HTMLElement);
  if (!(await navigate(route))) remember(undefined);
}
</script>

<template>
  <tr :data-request-row="record.displayId">
    <td>
      <div class="pe-request-identity">
        <UButton
          type="button"
          variant="link"
          class="pe:justify-self-start pe:p-0 pe:text-start pe:wrap-anywhere"
          :data-pe-focus-key="'request-row-' + record.id"
          data-testid="request-row-title"
          :label="record.title"
          @click="open($event, 'request')"
        />
        <div class="pe-request-row-meta">
          <span>{{ text.revision(record.displayId, record.revision) }}</span>
          <UButton
            v-if="pbi"
            type="button"
            variant="link"
            size="xs"
            class="pe:p-0"
            :title="pbi.title"
            :data-pe-focus-key="'request-row-pbi-' + record.id"
            :label="record.pbiId"
            @click="open($event, 'pbi')"
          />
          <span v-else
            >{{ record.pbiId
            }}<template v-if="backlog.ready"> · {{ text.unavailablePbi }}</template></span
          >
        </div>
      </div>
    </td>
    <td>
      <span class="pe-request-field-label" data-testid="request-delivery-label">{{
        text.delivery
      }}</span>
      <div class="pe-request-column">
        <span class="pe-request-state">{{ text.states[record.state] }}</span>
        <span v-if="record.runId" class="pe:text-xs pe:font-mono">{{ record.runId }}</span>
        <span v-if="record.blocker" class="pe:text-xs">{{ text.blockers[record.blocker] }}</span>
      </div>
    </td>
    <td>
      <span class="pe-request-field-label" data-testid="request-gates-label">{{
        text.gateProgress
      }}</span>
      <UButton
        type="button"
        variant="link"
        class="pe:p-0 pe:text-start pe:wrap-anywhere"
        data-testid="request-row-gates"
        :data-pe-focus-key="'request-row-gates-' + record.id"
        :label="gates"
        @click="open($event, 'gates')"
      />
    </td>
  </tr>
</template>
