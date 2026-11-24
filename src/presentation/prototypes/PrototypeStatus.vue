<script setup lang="ts">
import { computed, watch } from "vue";
import {
  currentPrototypeFingerprint,
  prototypeInputChanges,
  prototypeOutputStatus,
} from "../../application/prototypes";
import type { PrototypeRecord } from "../../application/prototypes";
import { useAsyncStream, useMessages, useQuery } from "../shell";

const {
  record,
  detail = false,
  fingerprint = undefined,
} = defineProps<{
  readonly record: PrototypeRecord;
  readonly detail?: boolean;
  readonly fingerprint?: string | undefined;
}>();
const text = useMessages().prototypes;
const changes = useAsyncStream({}, prototypeInputChanges);
const inspection = useQuery(currentPrototypeFingerprint);
watch(
  [() => record, changes],
  () => {
    if (!detail && record.values.output_input_fingerprint) void inspection.run(record);
  },
  { immediate: true },
);
const status = computed(() =>
  prototypeOutputStatus(record, detail ? fingerprint : inspection.value.value),
);
</script>

<template>
  <span class="pe-prototype-status" :data-output-status="status">{{ text.statuses[status] }}</span>
</template>
