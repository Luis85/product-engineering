<script setup lang="ts">
import { computed } from "vue";
import { PROJECT_TRACE } from "../../application/trace";
import { useRoute } from "../shell";
import TraceWorkspace from "./TraceWorkspace.vue";

const route = useRoute();
const scope = computed(() => (route.value.name === PROJECT_TRACE ? route.value : undefined));
</script>

<template>
  <TraceWorkspace v-if="scope" :key="scope.projectId" :route="scope" />
</template>
