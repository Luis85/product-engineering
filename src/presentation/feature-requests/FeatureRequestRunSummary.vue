<script setup lang="ts">
import { computed } from "vue";
import type { FeatureRequestRevision } from "../../application/feature-requests";
import { useMessages } from "../shell";

const { revision } = defineProps<{ readonly revision: FeatureRequestRevision | undefined }>();
const { factory } = useMessages()["feature-requests"];
const run = computed(() => revision?.run);
const fixture = computed(() => Boolean(revision?.package?.checksum || run.value));
const unassigned = computed(() => !revision?.runId);
const technical = computed(() => revision?.technical?.result);
</script>

<template>
  <p v-if="fixture" class="pe:text-sm pe:text-muted">
    {{ factory.fixture }}
  </p>
  <p v-if="run" data-testid="request-attempt">
    <code>{{ run.runId }}</code> · {{ factory.attempt(run.attempt) }}
  </p>
  <p v-else-if="unassigned">{{ factory.unassigned }}</p>
  <div v-if="technical" data-testid="request-technical-result">
    <p>{{ factory.ready }}</p>
    <p>{{ factory.pullRequest }} {{ technical.pullRequest }}</p>
    <p>
      {{ factory.commit }} <code>{{ technical.commit }}</code>
    </p>
  </div>
</template>
