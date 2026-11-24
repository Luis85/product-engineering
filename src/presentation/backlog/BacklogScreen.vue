<script setup lang="ts">
import { PROJECT_BACKLOG } from "../../application/backlog";
import { useRoute } from "../shell";
import BacklogBoard from "./BacklogBoard.vue";
import BacklogList from "./BacklogList.vue";

const route = useRoute();
</script>

<template>
  <template v-if="route.name === PROJECT_BACKLOG">
    <BacklogList v-if="route.tab === 'list' || route.item" :key="route.projectId" :route="route" />
    <BacklogBoard v-else :key="route.projectId" :project="route.projectId" />
  </template>
</template>
