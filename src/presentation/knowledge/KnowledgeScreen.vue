<script setup lang="ts">
import UButton from "@nuxt/ui/components/Button.vue";
import { computed, nextTick, onMounted, ref, watch } from "vue";
import {
  isKnowledgeKind,
  knowledgeBodyChanges,
  knowledgeBodySnapshot,
  knowledgeChanges,
  knowledgeDetailRoute,
  knowledgeExcerpts,
  knowledgeShelves,
  knowledgeSnapshot,
  PROJECT_KNOWLEDGE,
  projectKnowledge,
} from "../../application/knowledge";
import type { KnowledgeKind, KnowledgeRecord, KnowledgeShelf } from "../../application/knowledge";
import { rebuildNoteIndex } from "../../application/notes";
import {
  projectChanges,
  projectMembers,
  projectSearchMatches,
  projectSnapshot,
} from "../../application/projects";
import { useRestoreWorkspacePosition } from "../projects";
import { useCommand, useMessages, useNavigate, useQuery, useRoute, useStream } from "../shell";
import { libraryDefaults, useLibraryPreferences } from "./library-preferences";
import KnowledgeCreateDialog from "./KnowledgeCreateDialog.vue";
import KnowledgeFilters from "./KnowledgeFilters.vue";
import KnowledgeRows from "./KnowledgeRows.vue";

const catalog = useMessages();
const text = catalog.knowledge;
const templates = catalog.projects.templates.labels;
const route = useRoute();
const navigate = useNavigate();
const restorePosition = useRestoreWorkspacePosition();
const preferences = useLibraryPreferences();
const projects = useStream(projectSnapshot, projectChanges);
const library = useStream(knowledgeSnapshot, knowledgeChanges);
const bodyChange = useStream(knowledgeBodySnapshot, knowledgeBodyChanges);
const excerpts = useQuery(knowledgeExcerpts);
const retry = useCommand(() => rebuildNoteIndex);
const projectId = computed(() =>
  route.value.name === PROJECT_KNOWLEDGE ? route.value.projectId : undefined,
);
const state = computed(() => (projectId.value ? preferences(projectId.value) : libraryDefaults()));
const project = computed(() => projects.value.projects.find(({ id }) => id === projectId.value));
const failed = computed(() => library.value.failed || projects.value.failed);
const ready = computed(() => library.value.ready && projects.value.ready);
const available = computed(() => Boolean(project.value) && ready.value && !failed.value);
const members = computed(() => (project.value ? (projectMembers(project.value) ?? []) : []));
const entries = computed(() =>
  projectId.value ? projectKnowledge(projectId.value, library.value.records) : [],
);
const isFiltered = computed(() => Boolean(state.value.query.trim() || state.value.filter));
const shelves = Object.entries<readonly KnowledgeKind[]>(knowledgeShelves);
const creation = ref<{ projectId: NonNullable<typeof projectId.value>; template: KnowledgeKind }>();
const createButton = ref<{ $el: HTMLElement }>();
const filters = ref<InstanceType<typeof KnowledgeFilters>>();
let layoutSettled = false;

async function retryIndex() {
  await retry.run();
  await nextTick();
  filters.value?.focus();
}

function resetFilters() {
  Object.assign(state.value, libraryDefaults());
  filters.value?.focus();
}

function create() {
  const id = projectId.value;
  if (!id) return;
  const { filter, concept } = state.value;
  const template =
    filter === "concepts"
      ? concept || knowledgeShelves.concepts[0]
      : isKnowledgeKind(filter)
        ? filter
        : "prd";
  creation.value = { projectId: id, template };
}

async function closeCreation() {
  creation.value = undefined;
  await nextTick();
  createButton.value?.$el.focus({ preventScroll: true });
}
watch(projectId, () => {
  creation.value = undefined;
  layoutSettled = false;
});

const owner = (record: KnowledgeRecord) =>
  members.value.find(({ id }) => id === record.values.owner_id)?.name ??
  record.values.owner_id ??
  text.unassigned;
const kindLabel = (kind: string) => (isKnowledgeKind(kind) ? templates[kind] : kind);
function typeLabel(record: KnowledgeRecord) {
  const { kind, values } = record;
  const label = kindLabel(kind);
  return kind === "actor" && values.actor_type
    ? `${label} · ${text.actorTypes[values.actor_type]}`
    : label;
}

function matchesKind(record: KnowledgeRecord) {
  const { filter, actor, concept } = state.value;
  const { kind, values } = record;
  if (filter === "concepts") {
    return concept ? kind === concept : knowledgeShelves.concepts.some((type) => type === kind);
  }
  if (filter === "other") return !isKnowledgeKind(kind);
  if (filter === "actor" && actor) return kind === "actor" && actor === values.actor_type;
  return !filter || kind === filter;
}

function matches(record: KnowledgeRecord) {
  if (!matchesKind(record)) return false;
  const { kind, values, title, id, displayId } = record;
  return projectSearchMatches(
    state.value.query,
    title,
    id,
    displayId,
    values.requirement_id,
    kind,
    typeLabel(record),
    owner(record),
  );
}

const filtered = computed(() => entries.value.filter(matches));
const groups = computed(() =>
  shelves.flatMap(([key, kinds]) => {
    const group = key as KnowledgeShelf;
    const records = filtered.value.filter(({ kind }) =>
      group === "other" ? !isKnowledgeKind(kind) : kinds.some((type) => type === kind),
    );
    return records.length
      ? [
          {
            group,
            records: records.toSorted(
              (a, b) =>
                kinds.findIndex((type) => type === a.kind) -
                  kinds.findIndex((type) => type === b.kind) ||
                a.title.localeCompare(b.title, catalog.shell.language) ||
                a.id.localeCompare(b.id),
            ),
          },
        ]
      : [];
  }),
);

watch(filtered, (rows) => void excerpts.run(rows), { immediate: true });
watch(bodyChange, (change) => {
  if (change && filtered.value.some(({ path }) => path === change.path))
    void excerpts.run(filtered.value);
});
onMounted(restorePosition);
watch(groups, () => restorePosition(), { flush: "post" });
watch(
  excerpts.value,
  (loaded) => {
    if (layoutSettled || !loaded?.size) return;
    layoutSettled = true;
    // The initial scroll can be clamped while the excerpts are still loading.
    restorePosition("settled");
  },
  { flush: "post" },
);
watch(
  () => state.value.filter,
  () => {
    if (state.value.filter !== "actor") state.value.actor = "";
    if (state.value.filter !== "concepts") state.value.concept = "";
  },
);

function view(record: KnowledgeRecord) {
  return navigate(
    knowledgeDetailRoute(record.projectId, record.id, {
      section: "knowledge",
      reference: { kind: "knowledge", recordId: record.id },
    }),
  );
}
</script>

<template>
  <div class="pe:grid pe:min-w-0 pe:gap-4" data-testid="knowledge-library">
    <div class="pe:flex pe:min-w-0 pe:flex-wrap pe:items-start pe:justify-between pe:gap-2">
      <h1 tabindex="-1" class="pe:text-2xl pe:font-semibold">{{ text.title }}</h1>
      <UButton
        v-if="available"
        ref="createButton"
        type="button"
        icon="i-lucide-plus"
        data-testid="knowledge-create"
        data-pe-focus-key="knowledge-create"
        @click="create"
        >{{ text.create }}</UButton
      >
    </div>
    <div v-if="failed" role="alert" class="pe:grid pe:justify-items-start pe:gap-2">
      <p>{{ text.failed }}</p>
      <UButton type="button" variant="soft" :loading="retry.pending.value" @click="retryIndex">{{
        text.retry
      }}</UButton>
    </div>
    <p v-else-if="!ready" role="status">{{ text.loading }}</p>
    <p v-else-if="!project" role="status">{{ text.missing }}</p>
    <template v-else>
      <KnowledgeFilters
        ref="filters"
        v-model:query="state.query"
        v-model:filter="state.filter"
        v-model:actor="state.actor"
        v-model:concept="state.concept"
      />
      <div class="pe:flex pe:flex-wrap pe:items-center pe:gap-3">
        <p class="pe:text-sm pe:text-muted" role="status">{{ text.count(filtered.length) }}</p>
        <UButton
          v-if="isFiltered"
          type="button"
          color="neutral"
          variant="ghost"
          @click="resetFilters"
          >{{ text.reset }}</UButton
        >
      </div>
      <p
        v-if="!filtered.length"
        data-testid="knowledge-state"
        class="pe:rounded-lg pe:border pe:border-default pe:p-4 pe:text-muted"
      >
        {{ entries.length ? text.noMatches : text.empty }}
      </p>
      <KnowledgeRows
        :groups="groups"
        :excerpts="excerpts.value.value"
        :type-label="typeLabel"
        :owner="owner"
        @select="view"
      />
    </template>
    <KnowledgeCreateDialog
      v-if="creation"
      :project-id="creation.projectId"
      :initial-template="creation.template"
      @dismiss="closeCreation"
    />
  </div>
</template>
