<script setup lang="ts">
import UButton from "@nuxt/ui/components/Button.vue";
import { computed } from "vue";
import { openKnowledgeNote, projectKnowledgeRoute } from "../../../application/knowledge";
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
import { useCommand, useMessages, useNavigate } from "../../shell";

const { record, resolved, administration } = defineProps<{
  readonly record: ProjectRecordRoute;
  readonly resolved:
    ProjectSearchRecord<Extract<Route, { readonly projectId: ProjectId }>> | undefined;
  readonly administration: boolean;
}>();
const texts = useMessages();
const text = texts.projects;
const navigate = useNavigate();
const { pending: filePending, message: fileMessage, run: openFile } = useCommand(openKnowledgeNote);
const destination = computed(() => {
  if (administration || resolved?.route.name === PROJECT_RECORD) return undefined;
  return resolved?.route;
});

function leave() {
  const { origin, projectId, reference } = record;
  if (origin?.section === "knowledge") return navigate(projectKnowledgeRoute(projectId));
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
    v-if="resolved?.notePath"
    type="button"
    variant="soft"
    class="pe:justify-self-start"
    data-testid="knowledge-file"
    :data-note-path="resolved.notePath"
    :loading="filePending"
    @click="openFile(record.projectId, record.reference.recordId)"
    >{{ texts.knowledge.openFile }}</UButton
  >
  <p v-if="fileMessage" role="alert">{{ fileMessage.title }}</p>
  <UButton
    v-if="destination"
    type="button"
    variant="soft"
    class="pe:justify-self-start"
    @click="open"
    >{{ text.openRecord }}</UButton
  >
  <UButton
    type="button"
    variant="soft"
    class="pe:justify-self-start"
    data-testid="project-record-return"
    @click="leave"
    >{{ text.returnToOrigin }}</UButton
  >
</template>
