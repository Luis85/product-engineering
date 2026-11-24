<script setup lang="ts">
import UButton from "@nuxt/ui/components/Button.vue";
import { computed } from "vue";
import {
  PROJECT_BACKLOG,
  PROJECT_USE_CASE,
  backlogBoardRoute,
  backlogRoute,
  deliverablesRoute,
  pbiDetailRoute,
} from "../../../application/backlog";
import { domainModelRoute } from "../../../application/domain-model";
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
import { PROJECT_STORY_MAPS, storyMapsRoute } from "../../../application/story-maps";
import { isDeliverableId } from "../../../domain/backlog";
import { isStoryMapId } from "../../../domain/story-maps";
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
const { definition, history } = useRouting();
const { back } = useHistory();
const { pending: filePending, message: fileMessage, run: openFile } = useCommand(openKnowledgeNote);
const destination = computed(() => {
  if (administration || resolved?.route.name === PROJECT_RECORD) return undefined;
  return resolved?.route;
});

function sectionOrigin(projectId: ProjectId, origin: ProjectRecordRoute["origin"]) {
  if (!origin) return;
  const id = origin.reference?.recordId;
  switch (origin.section) {
    case "knowledge":
      return projectKnowledgeRoute(projectId);
    case "board-git":
      return backlogBoardRoute(projectId);
    case "backlog":
      return backlogRoute(projectId, id);
    case "usecase":
      return pbiOrigin(projectId, id);
    case "domainmodel":
      return domainModelRoute(projectId, id);
    case "templates": {
      return templateOrigin(projectId, id);
    }
    default:
      return;
  }
}

function storyMapOrigin(projectId: ProjectId, origin: ProjectRecordRoute["origin"]) {
  if (origin?.section !== "storymaps") return;
  const id = origin.reference?.recordId;
  return storyMapsRoute(projectId, isStoryMapId(id) ? id : undefined);
}

function deliverableOrigin(projectId: ProjectId, origin: ProjectRecordRoute["origin"]) {
  if (origin?.section !== "deliverables") return;
  const id = origin.reference?.recordId;
  return deliverablesRoute(projectId, isDeliverableId(id) ? id : undefined);
}

function pbiOrigin(projectId: ProjectId, id: string | undefined) {
  return id?.startsWith("UC-") ? pbiDetailRoute(projectId, id) : backlogRoute(projectId);
}

function templateOrigin(projectId: ProjectId, id: string | undefined) {
  const template = projectTemplateIds.find((candidate) => candidate === id);
  return template
    ? projectTemplateReturnRoute(projectId, template)
    : projectAdministrationRoute(projectId, "templates");
}

function returnToSection(section: Route) {
  const last = history.value.back.at(-1);
  if (section.name === PROJECT_STORY_MAPS && last && definition.equals(last, section))
    return back();
  if (returnsToPbi(last, section)) return back();
  if (record.origin?.section === "board-git" && returnsToBoard(last)) return back();
  return navigate(section);
}

function returnsToPbi(last: Route | undefined, section: Route) {
  return (
    section.name === PROJECT_USE_CASE &&
    last?.name === PROJECT_USE_CASE &&
    last.projectId === section.projectId &&
    last.pbiId === section.pbiId
  );
}

function returnsToBoard(last: Route | undefined) {
  return (
    last?.name === PROJECT_BACKLOG &&
    last.projectId === record.projectId &&
    (last.tab === undefined || last.tab === "board") &&
    !last.item
  );
}

function leave() {
  const { projectId, reference } = record;
  const section =
    storyMapOrigin(projectId, record.origin) ??
    deliverableOrigin(projectId, record.origin) ??
    sectionOrigin(projectId, record.origin);
  if (section) return returnToSection(section);
  const { section: previousSection, reference: previous } = record.origin ?? {};
  if (previous && !sameReference(reference, previous)) {
    const last = history.value.back.at(-1);
    if (returnsTo(last, projectId, previous)) return back();
    return navigate(projectRecordRoute({ projectId, ...previous }));
  }
  return navigate(
    previousSection === "administration"
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
