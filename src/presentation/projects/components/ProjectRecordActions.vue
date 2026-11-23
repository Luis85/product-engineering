<script setup lang="ts">
import UButton from "@nuxt/ui/components/Button.vue";
import { computed } from "vue";
import {
  PROJECT_RECORD,
  projectAdministrationRoute,
  projectOverviewRoute,
  projectRecordRoute,
} from "../../../application/projects";
import type {
  ProjectId,
  ProjectRecordRoute,
  ProjectSearchRecord,
} from "../../../application/projects";
import type { Route } from "../../../application/routes";
import { useMessages, useNavigate } from "../../shell";

const { record, resolved, administration } = defineProps<{
  readonly record: ProjectRecordRoute;
  readonly resolved:
    ProjectSearchRecord<Extract<Route, { readonly projectId: ProjectId }>> | undefined;
  readonly administration: boolean;
}>();
const text = useMessages().projects;
const navigate = useNavigate();
const destination = computed(() => {
  if (administration || resolved?.route.name === PROJECT_RECORD) return undefined;
  return resolved?.route;
});

function leave() {
  const { origin, projectId, reference } = record;
  if (origin?.reference) {
    const previous = origin.reference;
    if (previous.kind !== reference.kind || previous.recordId !== reference.recordId) {
      return navigate(projectRecordRoute({ projectId, ...previous }));
    }
  }
  return navigate(
    origin?.section === "administration"
      ? projectAdministrationRoute(projectId)
      : projectOverviewRoute(projectId),
  );
}

function open() {
  if (destination.value) return navigate(destination.value);
}
</script>

<template>
  <p v-if="!resolved" role="status">{{ text.missingRecord }}</p>
  <p v-if="resolved?.displayId" class="pe:text-muted">{{ resolved.displayId }}</p>
  <UButton
    v-if="destination"
    type="button"
    variant="soft"
    class="pe:justify-self-start"
    @click="open"
    >{{ text.openRecord }}</UButton
  >
  <UButton type="button" variant="soft" class="pe:justify-self-start" @click="leave">{{
    text.returnToOrigin
  }}</UButton>
</template>
