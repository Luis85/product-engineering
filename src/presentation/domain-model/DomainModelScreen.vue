<script setup lang="ts">
import UButton from "@nuxt/ui/components/Button.vue";
import { computed, nextTick, ref, watch } from "vue";
import {
  PROJECT_DOMAIN_MODEL,
  deleteDomainEdge,
  domainEdges,
  domainModelRoute,
  entityRecords,
  readDomainEntity,
  setEntityArchived,
} from "../../application/domain-model";
import type { DomainEdge } from "../../application/domain-model";
import {
  knowledgeBodyChanges,
  knowledgeBodySnapshot,
  knowledgeChanges,
  knowledgeDetailRoute,
  knowledgeSnapshot,
} from "../../application/knowledge";
import { projectChanges, projectSnapshot } from "../../application/projects";
import { useCommand, useMessages, useNavigate, useQuery, useRoute, useStream } from "../shell";
import DomainCanvas from "./DomainCanvas.vue";
import DomainConfirmation from "./DomainConfirmation.vue";
import DomainEdgeDialog from "./DomainEdgeDialog.vue";
import DomainEntityDialog from "./DomainEntityDialog.vue";
import DomainHeading from "./DomainHeading.vue";
import DomainSelection from "./DomainSelection.vue";

const catalog = useMessages();
const text = catalog["domain-model"];
const navigate = useNavigate();
const route = useRoute();
const model = computed(() => (route.value.name === PROJECT_DOMAIN_MODEL ? route.value : undefined));
const projects = useStream(projectSnapshot, projectChanges);
const project = computed(() =>
  projects.value.projects.find(({ id }) => id === model.value?.projectId),
);
const known = useStream(knowledgeSnapshot, knowledgeChanges);
const records = computed(() =>
  project.value ? entityRecords(project.value.id, known.value.records) : [],
);
const entities = computed(() => records.value.filter(({ values }) => !values.domain_archived));
const names = computed(
  () =>
    new Map<string, (typeof records.value)[number]>(
      records.value.map((record) => [record.id, record]),
    ),
);
const activeIds = computed(() => new Set(entities.value.map(({ id }) => id)));
const relationships = computed(() => domainEdges(records.value));
const edges = computed(() =>
  relationships.value.filter(
    ({ source, target }) => activeIds.value.has(source) && activeIds.value.has(target),
  ),
);
const selectedEdge = computed(() =>
  relationships.value.find(({ id }) => id === model.value?.selection),
);
const selected = computed(() => {
  const key = model.value?.selection;
  if (selectedEdge.value) return undefined;
  return key
    ? (records.value.find(({ id }) => id === key) ??
        records.value.find(({ displayId }) => displayId === key))
    : entities.value[0];
});
const detail = useQuery(readDomainEntity);
const note = computed(() =>
  detail.value.value?.id === selected.value?.id ? detail.value.value : undefined,
);
const bodyChanges = useStream(knowledgeBodySnapshot, knowledgeBodyChanges);
watch(
  selected,
  (value) => {
    if (value) void detail.run(value);
  },
  { immediate: true },
);
watch(bodyChanges, (event) => {
  const current = selected.value;
  if (current && event?.path === current.path) void detail.run(current);
});
const dialog = ref<"create" | "edit" | "create-edge" | "edit-edge" | "archive" | "delete-edge">();
const archive = useCommand(setEntityArchived);
const deleteEdge = useCommand(deleteDomainEdge);
const confirmation = computed(() =>
  dialog.value === "archive"
    ? { title: text.archiveEntity, question: text.archiveQuestion, command: archive }
    : dialog.value === "delete-edge"
      ? { title: text.deleteEdge, question: text.deleteQuestion, command: deleteEdge }
      : undefined,
);
let trigger: HTMLElement | undefined;

function openDialog(kind: Exclude<typeof dialog.value, undefined>, event: Event) {
  trigger = event.currentTarget as HTMLElement;
  dialog.value = kind;
}

function closeDialog() {
  dialog.value = undefined;
  void nextTick(() => trigger?.focus({ preventScroll: true }));
}

function pick(id?: string) {
  if (project.value) return navigate(domainModelRoute(project.value.id, id));
}

function saved(id: string) {
  closeDialog();
  void pick(id);
}

async function confirm() {
  if (!project.value) return;
  const base = note.value;
  const edge: DomainEdge | undefined = selectedEdge.value;
  const result =
    dialog.value === "archive" && base
      ? await archive.run(base, true)
      : edge
        ? await deleteEdge.run(project.value.id, edge)
        : undefined;
  if (result?._tag === "success") {
    closeDialog();
    void pick();
  }
}

function openNote(entity = selected.value) {
  if (entity)
    return navigate(
      knowledgeDetailRoute(entity.projectId, entity.id, {
        section: "domainmodel",
        reference: { kind: "entity", recordId: entity.id },
      }),
    );
}

const hasEntities = computed(() => entities.value.length > 0);
const selection = computed(() => selectedEdge.value?.id ?? selected.value?.id);
const showSelection = computed(() => hasEntities.value || Boolean(selection.value));
const archiveList = computed(() => !hasEntities.value && records.value.length > 0);
const viewport = computed(() =>
  project.value && hasEntities.value
    ? {
        projectId: project.value.id,
        entities: entities.value,
        edges: edges.value,
        selected: selection.value,
      }
    : undefined,
);
const status = computed(() => {
  if (!projects.value.ready || !known.value.ready)
    return { role: "status", label: catalog.knowledge.loading };
  if (projects.value.failed || known.value.failed)
    return { role: "alert", label: catalog.projects.unavailable };
  if (!project.value) return { role: "status", label: catalog.projects.missingRecord };
  if (!hasEntities.value) return { role: "status", label: text.empty, empty: true };
  return undefined;
});
const editableEdge = computed(() => {
  const edge = selectedEdge.value;
  return Boolean(
    edge &&
    activeIds.value.has(edge.source) &&
    !names.value.get(edge.target)?.values.domain_archived,
  );
});
const entityEditor = computed(() => {
  const projectId = project.value?.id;
  if (!projectId) return undefined;
  if (dialog.value === "create") return { projectId };
  if (dialog.value === "edit" && note.value) return { projectId, base: note.value };
  return undefined;
});
const edgeEditor = computed(() => {
  const projectId = project.value?.id;
  if (!projectId) return undefined;
  if (dialog.value === "edit-edge" && selectedEdge.value) {
    return { projectId, entities: entities.value, edge: selectedEdge.value };
  }
  if (dialog.value === "create-edge") {
    const source = selected.value?.id ?? selectedEdge.value?.source;
    return { projectId, entities: entities.value, source };
  }
  return undefined;
});
</script>
<template>
  <section class="pe:grid pe:min-w-0 pe:gap-4" data-testid="domain-model">
    <DomainHeading
      :can-create="Boolean(project)"
      :can-relate="hasEntities"
      @create="openDialog('create', $event)"
      @relate="openDialog('create-edge', $event)"
    />
    <p
      v-if="status"
      :role="status.role"
      :class="{ 'pe-domain-panel': status.empty }"
      :data-testid="status.empty ? 'domain-empty' : undefined"
    >
      {{ status.label }}
    </p>
    <DomainCanvas v-if="viewport" :key="viewport.projectId" v-bind="viewport" @select="pick" />
    <ul v-if="archiveList" class="pe:grid pe:gap-1" :aria-label="text.archived">
      <li v-for="archived in records" :key="archived.id">
        <UButton type="button" color="neutral" variant="link" @click="openNote(archived)">
          {{ archived.title }} · {{ text.archived }}
        </UButton>
      </li>
    </ul>
    <DomainSelection
      v-if="showSelection"
      :entity="selected"
      :note="note"
      :selected-edge="selectedEdge"
      :editable-edge="editableEdge"
      :names="names"
      :edges="edges"
      :has-entities="hasEntities"
      @select="pick"
      @open="openNote()"
      @edit-edge="openDialog('edit-edge', $event)"
      @delete-edge="openDialog('delete-edge', $event)"
      @edit-entity="openDialog('edit', $event)"
      @archive="openDialog('archive', $event)"
    />
    <DomainEntityDialog
      v-if="entityEditor"
      :key="entityEditor.projectId"
      v-bind="entityEditor"
      @dismiss="closeDialog"
      @saved="saved"
    />
    <DomainEdgeDialog
      v-if="edgeEditor"
      :key="edgeEditor.projectId"
      v-bind="edgeEditor"
      @dismiss="closeDialog"
      @saved="saved"
    />
    <DomainConfirmation
      v-if="confirmation"
      :title="confirmation.title"
      :question="confirmation.question"
      :action="confirmation.title"
      :pending="confirmation.command.pending.value"
      :error="confirmation.command.message.value"
      @dismiss="closeDialog"
      @confirm="confirm"
    />
  </section>
</template>
