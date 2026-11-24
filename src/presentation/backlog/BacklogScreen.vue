<script setup lang="ts">
import { PROJECT_BACKLOG } from "../../application/backlog";
import { useRoute } from "../shell";
import BacklogBoard from "./BacklogBoard.vue";
import BacklogList from "./BacklogList.vue";
import DeliverablesRegister from "./deliverables/DeliverablesRegister.vue";
import NfrCatalog from "./nfr/NfrCatalog.vue";

const route = useRoute();
</script>

<template>
  <template v-if="route.name === PROJECT_BACKLOG">
    <NfrCatalog
      v-if="route.tab === 'nfrs'"
      :key="route.projectId"
      :project="route.projectId"
      :selected="route.nfr"
      :from-item="route.nfrFromItem"
    />
    <DeliverablesRegister
      v-else-if="route.tab === 'deliverables'"
      :key="route.projectId"
      :project="route.projectId"
      :selected="route.deliverable"
    />
    <BacklogList
      v-else-if="route.tab === 'list' || route.item"
      :key="route.projectId"
      :route="route"
    />
    <BacklogBoard
      v-else
      :key="route.projectId"
      :project="route.projectId"
      :resumed="route.boardReturn"
    />
  </template>
</template>
