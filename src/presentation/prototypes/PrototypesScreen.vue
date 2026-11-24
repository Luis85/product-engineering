<script setup lang="ts">
import { computed } from "vue";
import { PROJECT_PROTOTYPES } from "../../application/prototypes";
import { useRoute } from "../shell";
import PrototypesWorkspace from "./PrototypesWorkspace.vue";

const route = useRoute();
const scope = computed(() => (route.value.name === PROJECT_PROTOTYPES ? route.value : undefined));
</script>

<template><PrototypesWorkspace v-if="scope" :key="scope.projectId" :route="scope" /></template>
