<script setup lang="ts">
import { computed } from "vue";
import { PROJECT_REVIEWS } from "../../application/feature-requests";
import { useRoute } from "../shell";
import ReviewsWorkspace from "./ReviewsWorkspace.vue";

const route = useRoute();
const scope = computed(() => (route.value.name === PROJECT_REVIEWS ? route.value : undefined));
</script>

<template><ReviewsWorkspace v-if="scope" :key="scope.projectId" :route="scope" /></template>
