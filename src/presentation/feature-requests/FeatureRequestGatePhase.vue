<script setup lang="ts">
import type { RequestGate } from "../../domain/feature-requests";
import type { ProjectBaseCheck, ProjectGatePhase } from "../../domain/projects";
import { requestGateProgress } from "../../application/feature-requests";
import { computed } from "vue";
import { useMessages } from "../shell";

const { phase, gates, manual, pending } = defineProps<{
  readonly phase: ProjectGatePhase;
  readonly gates: readonly RequestGate[] | undefined;
  readonly manual: ReadonlySet<string>;
  readonly pending: boolean;
}>();
const emit = defineEmits<{ toggle: [string, boolean] }>();
const messages = useMessages();
const text = messages["feature-requests"];
const label = computed(() => {
  const count = requestGateProgress(gates);
  const progress = count ? text.gateCount(count.met, count.total) : text.gatesUnavailable;
  return `${messages.projects.definitions.phases[phase]} · ${progress}`;
});
const titleFor = ({ id, title }: RequestGate) =>
  title ?? messages.projects.definitions.baseChecks[id as ProjectBaseCheck] ?? id;
</script>

<template>
  <div class="pe-request-gate-phase">
    <h3 class="pe:font-semibold">{{ label }}</h3>
    <ul v-if="gates?.length" class="pe:grid pe:gap-1">
      <li v-for="gate in gates" :key="gate.id" class="pe-request-gate-row">
        <label v-if="manual.has(gate.id)" class="pe:flex pe:items-center pe:gap-2">
          <input
            type="checkbox"
            :checked="gate.status === 'passed'"
            :disabled="pending"
            data-testid="request-confirm-ready"
            @change="emit('toggle', gate.id, ($event.target as HTMLInputElement).checked)"
          />
          {{ titleFor(gate) }}
        </label>
        <span v-else>{{ titleFor(gate) }}</span>
        <span class="pe-request-state">{{ text.gateStatus[gate.status] }}</span>
      </li>
    </ul>
    <slot />
  </div>
</template>
