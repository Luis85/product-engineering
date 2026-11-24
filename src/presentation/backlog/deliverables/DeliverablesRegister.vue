<script setup lang="ts">
import UButton from "@nuxt/ui/components/Button.vue";
import { computed, nextTick, ref, shallowRef, watch } from "vue";
import {
  PROJECT_BACKLOG,
  deliverableNote,
  deliverablesChanges,
  deliverablesRoute,
  deliverablesSnapshot,
  setDeliverableStatus,
} from "../../../application/backlog";
import type { DeliverableRecord } from "../../../application/backlog";
import {
  knowledgeChanges,
  knowledgeDetailRoute,
  knowledgeSnapshot,
  projectKnowledge,
} from "../../../application/knowledge";
import type { KnowledgeRecord } from "../../../application/knowledge";
import {
  projectChanges,
  projectMemberChoices,
  projectSnapshot,
} from "../../../application/projects";
import type { ProjectId } from "../../../application/projects";
import { deliverableStatuses } from "../../../domain/backlog";
import type { DeliverableId } from "../../../domain/backlog";
import { useRememberWorkspaceOrigin, useRestoreWorkspacePosition } from "../../projects";
import {
  ErrorNotice,
  useCommand,
  useHistory,
  useMessages,
  useNavigate,
  useQuery,
  useRouting,
  useStream,
} from "../../shell";
import BacklogTabs from "../BacklogTabs.vue";
import DeliverableEditor from "./DeliverableEditor.vue";
import DeliverableFilters from "./DeliverableFilters.vue";
import DeliverableNoteCreation from "./DeliverableNoteCreation.vue";
import DeliverableRows from "./DeliverableRows.vue";
import { deliverableRows, useDeliverableFilters, visibleDeliverableRows } from "./register-rows";

const { project, selected = undefined } = defineProps<{
  readonly project: ProjectId;
  readonly selected?: DeliverableId | undefined;
}>();
const messages = useMessages();
const texts = messages.backlog;
const text = texts.deliverables;
const catalog = useStream(deliverablesSnapshot(project), deliverablesChanges(project));
const knowledge = useStream(knowledgeSnapshot, knowledgeChanges);
const notes = computed(() => projectKnowledge(project, knowledge.value.records));
const projects = useStream(projectSnapshot, projectChanges);
const currentProject = computed(() => projects.value.projects.find(({ id }) => id === project));
const memberChoices = useQuery(projectMemberChoices);
watch(currentProject, () => void memberChoices.run(project), { immediate: true });
const owners = computed(() => memberChoices.value.value ?? []);
const filters = useDeliverableFilters(project);
const filtered = computed(() => Boolean(filters.query || filters.status || filters.template));
const allRows = computed(() => deliverableRows(catalog.value.records, notes.value, owners.value));
const rows = computed(() => visibleDeliverableRows(allRows.value, filters));
const feedback = ref("");
const creating = ref(false);
const linkOnOpen = ref(false);
const panel = ref<HTMLElement>();
const navigate = useNavigate();
const { history } = useRouting();
const { back } = useHistory();
const remember = useRememberWorkspaceOrigin();
const restore = useRestoreWorkspacePosition();
const editing = shallowRef<DeliverableRecord>();
const preparing = shallowRef<{
  readonly record: DeliverableRecord;
  readonly trigger: HTMLElement;
}>();
const changeStatus = useCommand(setDeliverableStatus);
const statusError = changeStatus.message;
const changingStatus = changeStatus.pending;
const editorOpen = computed(() => creating.value || Boolean(editing.value));
const editorKey = computed(() => editing.value?.id ?? "new");
const missing = computed(() => selected && catalog.value.ready && !editing.value);
const pendingProof = computed(() => {
  const record = preparing.value?.record;
  if (record?.values.pending_knowledge_id) return deliverableNote(record, notes.value);
  return undefined;
});
const resultsMessage = computed(() => {
  if (catalog.value.failed) return { label: text.errors.scope, role: "alert" };
  if (!catalog.value.ready) return { label: text.loading, role: "status" };
  if (!allRows.value.length)
    return { label: text.empty, role: "status", test: "deliverable-empty" };
  if (!rows.value.length)
    return { label: text.filtered, role: "status", test: "deliverable-filtered-empty" };
  return undefined;
});
let trigger: HTMLElement | undefined;
let focusId: DeliverableId | undefined;
let statusFocusId: DeliverableId | undefined;

watch(
  [() => selected, catalog],
  ([id, snapshot], previous) => {
    if (id !== previous?.[0]) editing.value = undefined;
    const record = snapshot.records.find((entry) => entry.id === id);
    if (record) {
      editing.value = record;
      if (id !== previous?.[0] && !rows.value.some((row) => row.record.id === id)) reset();
    }
  },
  { immediate: true },
);

function create(event: MouseEvent) {
  trigger = event.currentTarget as HTMLElement;
  creating.value = true;
}

function reset(focus = false) {
  filters.query = "";
  filters.status = "";
  filters.template = "";
  if (focus) focusControl("deliverable-search");
}

function focusControl(key: string) {
  const control = Array.from(
    panel.value?.querySelectorAll<HTMLElement>("[data-pe-focus-key]") ?? [],
  ).find((element) => element.dataset.peFocusKey === key);
  control?.focus({ preventScroll: true });
  return Boolean(control);
}

async function edit(record: DeliverableRecord, event: MouseEvent, focusLink = false) {
  trigger = event.currentTarget as HTMLElement;
  linkOnOpen.value = focusLink;
  remember(trigger);
  if (!(await navigate(deliverablesRoute(project, record.id)))) remember(undefined);
}

async function openNote(record: DeliverableRecord, note: KnowledgeRecord, event: MouseEvent) {
  remember(event.currentTarget as HTMLElement);
  const origin = {
    section: "deliverables",
    reference: { kind: "deliverable", recordId: record.id },
  };
  if (!(await navigate(knowledgeDetailRoute(project, note.id, origin)))) remember(undefined);
}

function prepareNote(record: DeliverableRecord, event: MouseEvent) {
  preparing.value = { record, trigger: event.currentTarget as HTMLElement };
}

function focusRecord() {
  if (selected || !focusId) return;
  if (focusControl("deliverable-" + focusId)) focusId = undefined;
}

function focusStatus() {
  if (!statusFocusId) return;
  if (!focusControl("deliverable-status-" + statusFocusId))
    focusControl("deliverable-filter-status");
  statusFocusId = undefined;
}

async function updateStatus(record: DeliverableRecord, event: Event) {
  const control = event.currentTarget as HTMLSelectElement;
  const status = deliverableStatuses.find((entry) => entry === control.value);
  if (!status || changeStatus.pending.value) {
    control.value = record.values.status;
    return;
  }
  const result = await changeStatus.run(record, status);
  if (result._tag !== "success") {
    control.value = record.values.status;
    return;
  }
  if (filters.status && filters.status !== status) {
    statusFocusId = record.id;
    await nextTick();
    if (!rows.value.some(({ record: row }) => row.id === record.id)) focusStatus();
  }
}

async function close(saved?: DeliverableId) {
  const origin = trigger;
  focusId = saved;
  if (saved) {
    const record = catalog.value.records.find(({ id }) => id === saved);
    if (record) feedback.value = text.saved(record.displayId);
    if (!rows.value.some((row) => row.record.id === saved)) reset();
  }
  if (creating.value) creating.value = false;
  else if (selected) await returnToCatalog(selected);
  linkOnOpen.value = false;
  trigger = undefined;
  await nextTick();
  if (focusId) focusRecord();
  else origin?.focus({ preventScroll: true });
}

async function returnToCatalog(id: DeliverableId) {
  const last = history.value.back.at(-1);
  if (
    last?.name === PROJECT_BACKLOG &&
    last.projectId === project &&
    last.tab === "deliverables" &&
    !last.deliverable
  )
    return back();
  focusId ??= id;
  return navigate(deliverablesRoute(project));
}

watch(
  rows,
  () => {
    restore();
    focusRecord();
    if (statusFocusId && !rows.value.some(({ record }) => record.id === statusFocusId))
      focusStatus();
  },
  { flush: "post" },
);
</script>

<template>
  <section ref="panel" class="pe-backlog pe-deliverables" data-testid="deliverables">
    <h1 tabindex="-1" class="pe:text-2xl pe:font-semibold">{{ texts.title }}</h1>
    <div class="pe-backlog-actions pe:justify-between">
      <BacklogTabs active="deliverables" :project="project" />
      <UButton
        type="button"
        data-testid="deliverable-create"
        data-pe-focus-key="deliverable-create"
        :label="text.create"
        @click="create"
      />
    </div>
    <div>
      <h2 class="pe:text-lg pe:font-semibold">{{ text.heading }}</h2>
      <p class="pe:text-muted">{{ text.intro }}</p>
    </div>
    <DeliverableFilters :model-value="filters" />
    <div class="pe-backlog-actions pe:justify-between">
      <p role="status">{{ text.count(rows.length, allRows.length, filtered) }}</p>
      <UButton
        v-if="filtered"
        type="button"
        color="neutral"
        variant="ghost"
        data-testid="deliverable-reset"
        :label="texts.reset"
        @click="reset(true)"
      />
    </div>
    <p v-if="feedback" role="status">{{ feedback }}</p>
    <ErrorNotice v-if="statusError" :message="statusError" />
    <p v-if="resultsMessage" :role="resultsMessage.role" :data-testid="resultsMessage.test">
      {{ resultsMessage.label }}
    </p>
    <DeliverableRows
      v-else
      :rows="rows"
      :changing="changingStatus"
      @edit="edit"
      @open-note="openNote"
      @create-note="prepareNote"
      @status="updateStatus"
    />
    <div v-if="missing" class="pe:grid pe:justify-items-start pe:gap-1">
      <p role="alert">{{ text.errors.missing }}</p>
      <UButton type="button" variant="ghost" :label="texts.cancel" @click="close()" />
    </div>
    <DeliverableEditor
      v-if="editorOpen"
      :key="editorKey"
      :project="project"
      :owners="owners"
      :notes="notes"
      :record="editing"
      :link-on-open="linkOnOpen"
      @dismiss="close"
    />
    <DeliverableNoteCreation
      v-if="preparing"
      :record="preparing.record"
      :trigger="preparing.trigger"
      :pending-note="pendingProof"
      @dismiss="preparing = undefined"
    />
  </section>
</template>
