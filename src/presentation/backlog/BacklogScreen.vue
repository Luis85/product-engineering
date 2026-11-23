<script setup lang="ts">
import { PROJECT_BACKLOG } from "../../application/backlog";
import { useRoute } from "../shell";
import BacklogList from "./BacklogList.vue";

const route = useRoute();
</script>

<template>
  <BacklogList v-if="route.name === PROJECT_BACKLOG" :key="route.projectId" :route="route" />
</template>
