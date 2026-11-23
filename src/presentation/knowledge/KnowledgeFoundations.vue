<script setup lang="ts">
import { computed } from "vue";
import type { KnowledgeOrigin, KnowledgeRecord } from "../../application/knowledge";
import { useMessages } from "../shell";
import KnowledgeSelect from "./KnowledgeSelect.vue";

const { visions, origin } = defineProps<{
  readonly visions: readonly KnowledgeRecord[];
  readonly jobsOptions: readonly KnowledgeRecord[];
  readonly selectedJobs: readonly string[];
  readonly invalid: string | undefined;
  readonly pending: boolean;
  readonly origin: KnowledgeOrigin | undefined;
}>();
const selectedVision = defineModel<string>("vision", { required: true });
const emit = defineEmits<{ toggleJob: [id: string, checked: boolean] }>();
const text = useMessages().knowledge;
const options = computed(() =>
  visions.map((vision) => ({ value: vision.id, label: `${vision.title} · ${vision.displayId}` })),
);
const originJob = computed(() => (origin?.kind === "job" ? origin.recordId : undefined));
</script>

<template>
  <fieldset class="pe:grid pe:min-w-0 pe:gap-3 pe:rounded-md pe:border pe:border-default pe:p-3">
    <legend class="pe:px-1 pe:font-medium">{{ text.foundations }}</legend>
    <KnowledgeSelect
      v-model="selectedVision"
      name="vision_id"
      :label="text.vision"
      :empty="text.noVision"
      :error="invalid === 'vision_id' ? text.errors.vision_id : undefined"
      :options="options"
      :disabled="pending || origin?.kind === 'vision'"
    />
    <fieldset class="pe:grid pe:min-w-0 pe:gap-1 pe:text-sm">
      <legend class="pe:font-medium">{{ text.jobs }}</legend>
      <p v-if="!jobsOptions.length" class="pe:text-muted">{{ text.noJobs }}</p>
      <label
        v-for="job in jobsOptions"
        :key="job.id"
        class="pe:flex pe:min-w-0 pe:items-baseline pe:gap-2"
      >
        <input
          type="checkbox"
          name="job_ids"
          :value="job.id"
          :checked="selectedJobs.includes(job.id)"
          :disabled="pending || originJob === job.id"
          :aria-invalid="invalid === 'job_ids'"
          @change="emit('toggleJob', job.id, ($event.target as HTMLInputElement).checked)"
        />
        <span class="pe:wrap-anywhere">{{ job.title }} · {{ job.displayId }}</span>
      </label>
      <span v-if="invalid === 'job_ids'" role="alert">{{ text.errors.job_ids }}</span>
    </fieldset>
  </fieldset>
</template>
