<script setup lang="ts">
import { PROJECT_USE_CASE } from "../../application/backlog";
import { useRoute } from "../shell";
import PbiDetail from "./PbiDetail.vue";
const active = useRoute();
</script>

<template>
  <PbiDetail
    v-if="active.name === PROJECT_USE_CASE"
    :key="active.projectId + '/' + active.pbiId + '/' + (active.tab ?? '')"
    :project-id="active.projectId"
    :pbi-id="active.pbiId"
    :initial-tab="active.tab"
  />
</template>
