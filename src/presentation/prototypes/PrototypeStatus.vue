<script setup lang="ts">
import { computed } from "vue";
import { prototypeOutputStatus } from "../../application/prototypes";
import type { PrototypeRecord } from "../../application/prototypes";
import { useMessages } from "../shell";

const { record } = defineProps<{ readonly record: PrototypeRecord }>();
const text = useMessages().prototypes;
const status = computed(() => prototypeOutputStatus(record));
</script>

<template>
  <span class="pe-prototype-status" :data-output-status="status">{{ text.statuses[status] }}</span>
</template>
