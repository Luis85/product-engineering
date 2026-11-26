<script setup lang="ts">
import { computed } from "vue";
import { PROJECT_FEATURE_REQUESTS } from "../../application/feature-requests";
import { useRoute } from "../shell";
import FeatureRequestsWorkspace from "./FeatureRequestsWorkspace.vue";

const route = useRoute();
const scope = computed(() =>
  route.value.name === PROJECT_FEATURE_REQUESTS ? route.value : undefined,
);
</script>

<template><FeatureRequestsWorkspace v-if="scope" :key="scope.projectId" :route="scope" /></template>
