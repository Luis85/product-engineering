<script setup lang="ts">
import UButton from "@nuxt/ui/components/Button.vue";
import {
  backlogBoardRoute,
  backlogRoute,
  backlogTabs,
  deliverablesRoute,
  nfrCatalogRoute,
} from "../../application/backlog";
import type { BacklogTab } from "../../application/backlog";
import type { ProjectId } from "../../application/projects";
import { useMessages, useNavigate } from "../shell";

const { active, project } = defineProps<{
  readonly active: BacklogTab;
  readonly project: ProjectId;
}>();
const text = useMessages().backlog;
const navigate = useNavigate();
const tabRoutes = {
  board: () => backlogBoardRoute(project, true),
  list: () => backlogRoute(project),
  nfrs: () => nfrCatalogRoute(project),
  deliverables: () => deliverablesRoute(project),
};

function select(tab: BacklogTab) {
  if (tab !== active) return navigate(tabRoutes[tab]());
}
</script>

<template>
  <nav :aria-label="text.views" class="pe-backlog-tabs pe-project-tabs">
    <UButton
      v-for="tab in backlogTabs"
      :key="tab"
      type="button"
      color="neutral"
      :variant="active === tab ? 'soft' : 'ghost'"
      :aria-pressed="active === tab"
      :data-testid="'backlog-tab-' + tab"
      :data-pe-focus-key="'backlog-tab-' + tab"
      :label="text.tabs[tab]"
      @click="select(tab)"
    />
  </nav>
</template>
