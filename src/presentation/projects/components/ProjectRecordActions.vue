<script setup lang="ts">
import UButton from "@nuxt/ui/components/Button.vue";
import { computed } from "vue";
import { openKnowledgeNote, projectKnowledgeRoute } from "../../../application/knowledge";
import {
  PROJECT_RECORD,
  projectAdministrationRoute,
  projectOverviewRoute,
  projectRecordRoute,
  projectTemplateIds,
  projectTemplateReturnRoute,
} from "../../../application/projects";
import type {
  ProjectId,
  ProjectRecordRoute,
  ProjectSearchRecord,
} from "../../../application/projects";
import type { Route } from "../../../application/routes";
import { useCommand, useHistory, useMessages, useNavigate, useRouting } from "../../shell";

const {
  record,
  resolved,
  administration,
  integrated = false,
} = defineProps<{
  readonly record: ProjectRecordRoute;
  readonly resolved:
    ProjectSearchRecord<Extract<Route, { readonly projectId: ProjectId }>> | undefined;
  readonly administration: boolean;
  readonly integrated?: boolean;
}>();
const texts = useMessages();
const text = texts.projects;
const navigate = useNavigate();
const { history } = useRouting();
const { back } = useHistory();
const { pending: filePending, message: fileMessage, run: openFile } = useCommand(openKnowledgeNote);
const destination = computed(() => {
  if (administration || resolved?.route.name === PROJECT_RECORD) return undefined;
  return resolved?.route;
});

function leave() {
  const { projectId, reference } = record;
  const { section, reference: previous } = record.origin ?? {};
  if (section === "knowledge") return navigate(projectKnowledgeRoute(projectId));
  if (section === "templates") {
    const template = projectTemplateIds.find((id) => id === previous?.recordId);
    return navigate(
      template
        ? projectTemplateReturnRoute(projectId, template)
        : projectAdministrationRoute(projectId, "templates"),
    );
  }
  if (previous && !sameReference(reference, previous)) {
    const last = history.value.back.at(-1);
    if (returnsTo(last, projectId, previous)) return back();
    return navigate(projectRecordRoute({ projectId, ...previous }));
  }
  return navigate(
    section === "administration"
      ? projectAdministrationRoute(projectId)
      : projectOverviewRoute(projectId),
  );
}

type Reference = ProjectRecordRoute["reference"];

function sameReference(first: Reference, second: Reference) {
  return first.kind === second.kind && first.recordId === second.recordId;
}

function returnsTo(last: Route | undefined, projectId: ProjectId, previous: Reference) {
  return (
    last?.name === PROJECT_RECORD &&
    last.projectId === projectId &&
    sameReference(last.reference, previous)
  );
}

function open() {
  if (destination.value) return navigate(destination.value);
}
</script>

<template>
  <p v-if="!resolved" role="status">{{ text.missingRecord }}</p>
  <p v-if="resolved?.displayId && !integrated" class="pe:text-muted">{{ resolved.displayId }}</p>
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
