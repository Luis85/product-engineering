<script setup lang="ts">
import UButton from "@nuxt/ui/components/Button.vue";
import { computed } from "vue";
import { pbiDetailRoute } from "../../application/backlog";
import type { BacklogSnapshot, PbiPreparationGap, PbiTab } from "../../application/backlog";
import type { FeatureRequest } from "../../application/feature-requests";
import type { ProjectBaseCheck } from "../../domain/projects";
import { projectGatePhases } from "../../domain/projects";
import { useRememberWorkspaceOrigin } from "../projects";
import { ErrorNotice, useMessages, useNavigate } from "../shell";
import { useRequestGates } from "./request-gates";

const { record, backlog } = defineProps<{
  readonly record: FeatureRequest;
  readonly backlog: BacklogSnapshot;
}>();
const messages = useMessages();
const text = messages["feature-requests"];
const { evidence, current, progress, pending, error } = useRequestGates(
  () => record,
  () => backlog,
);
const titleFor = (id: string, title: string | undefined) =>
  title ?? messages.projects.definitions.baseChecks[id as ProjectBaseCheck] ?? id;
const navigate = useNavigate();
const remember = useRememberWorkspaceOrigin();
const gap = computed(() => current.value?.gaps[0]);
const notice = computed(() => {
  if (pending.value) return text.loadingGates;
  return current.value?.rulesAvailable === false ? text.gatesUnavailable : undefined;
});
const preparationLabel = computed(
  () => gap.value && messages.backlog.pbiGates.reasons[gap.value.reason],
);
const showPreparation = (phase: string) => phase === "ready" && Boolean(preparationLabel.value);
const tabs: Partial<Record<PbiPreparationGap["reason"], PbiTab>> = {
  prd: "edit",
  research: "edit",
  adr: "edit",
  criteria: "criteria",
  scenario: "criteria",
  gitPending: "git",
  gitUnavailable: "git",
};

async function prepare(event: MouseEvent) {
  if (!gap.value) return;
  remember(event.currentTarget as HTMLElement);
  if (
    !(await navigate(
      pbiDetailRoute(record.projectId, record.pbiId, tabs[gap.value.reason] ?? "usecase"),
    ))
  )
    remember(undefined);
}
</script>

<template>
  <section class="pe-request-gates" :aria-busy="pending" data-testid="request-gates">
    <h2 class="pe:font-semibold">{{ text.gates }}</h2>
    <p v-if="notice" role="status">{{ notice }}</p>
    <ErrorNotice v-if="error" :message="error" />
    <div v-for="phase in projectGatePhases" :key="phase" class="pe-request-gate-phase">
      <h3 class="pe:font-semibold">
        {{ messages.projects.definitions.phases[phase] }} · {{ progress(evidence[phase]) }}
      </h3>
      <ul v-if="evidence[phase]?.length" class="pe:grid pe:gap-1">
        <li v-for="gate in evidence[phase]" :key="gate.id" class="pe-request-gate-row">
          <span>{{ titleFor(gate.id, gate.title) }}</span>
          <span class="pe-request-state">{{ text.gateStatus[gate.status] }}</span>
        </li>
      </ul>
      <UButton
        v-if="showPreparation(phase)"
        type="button"
        variant="link"
        class="pe:justify-self-start pe:p-0 pe:text-start pe:wrap-anywhere"
        data-testid="request-prepare"
        data-pe-focus-key="request-prepare"
        :label="preparationLabel ?? ''"
        @click="prepare"
      />
    </div>
  </section>
</template>
