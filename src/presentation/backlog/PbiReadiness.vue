<script setup lang="ts">
import UButton from "@nuxt/ui/components/Button.vue";
import { computed } from "vue";
import type { PbiPreparation, PbiPreparationGap } from "../../application/backlog";
import { useMessages } from "../shell";

const { preparation, pending, authorizing, expanded } = defineProps<{
  readonly preparation: PbiPreparation | undefined;
  readonly pending: boolean;
  readonly authorizing: boolean;
  readonly expanded: boolean;
}>();
const emit = defineEmits<{
  act: [PbiPreparationGap, MouseEvent];
  refresh: [];
  expand: [boolean];
}>();
const text = useMessages().backlog.pbiGates;
const issues = computed(
  () =>
    preparation?.gaps.map((gap) => ({
      gap,
      key: "pbi-gap-" + gap.reason + (gap.record?.id ?? ""),
      testId: "pbi-gap-" + gap.reason,
      label: text.reasons[gap.reason] + (gap.record ? " · " + gap.record.displayId : ""),
    })) ?? [],
);
const primary = computed(() => issues.value[0]);
const busy = computed(() => pending || authorizing);
const status = computed(() => (preparation?.ready ? text.ready : pending ? text.checking : ""));
</script>

<template>
  <section class="pe:grid pe:min-w-0 pe:gap-2" :aria-label="text.title">
    <div class="pe-backlog-actions">
      <UButton
        v-if="primary"
        type="button"
        data-testid="pbi-next"
        data-pe-focus-key="pbi-next"
        :label="primary.label"
        :loading="authorizing"
        @click="emit('act', primary.gap, $event)"
      />
      <p
        v-else-if="status"
        role="status"
        class="pe:font-medium"
        :data-testid="preparation?.ready ? 'pbi-ready' : undefined"
      >
        {{ status }}
      </p>
      <UButton
        type="button"
        variant="ghost"
        color="neutral"
        size="sm"
        data-testid="pbi-readiness-refresh"
        :disabled="busy"
        :label="text.retry"
        @click="emit('refresh')"
      />
    </div>
    <details
      v-if="issues.length"
      :open="expanded"
      class="pe:rounded-md pe:border pe:border-default pe:bg-muted pe:p-3"
      data-testid="pbi-gaps"
    >
      <summary class="pe:cursor-pointer pe:font-medium" @click.prevent="emit('expand', !expanded)">
        {{ text.title }} · {{ issues.length }}
      </summary>
      <ul class="pe:grid pe:gap-1 pe:pt-1">
        <li v-for="issue in issues" :key="issue.key">
          <UButton
            type="button"
            variant="link"
            class="pe:p-0 pe:text-start pe:wrap-anywhere"
            :data-testid="issue.testId"
            :data-pe-focus-key="issue.key"
            :label="issue.label"
            :disabled="authorizing"
            @click="emit('act', issue.gap, $event)"
          />
        </li>
      </ul>
    </details>
  </section>
</template>
