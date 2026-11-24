<script setup lang="ts">
import UButton from "@nuxt/ui/components/Button.vue";
import { computed, nextTick, ref, shallowRef, watch } from "vue";
import {
  PROJECT_BACKLOG,
  PROJECT_USE_CASE,
  nfrCatalogRoute,
  nfrChanges,
  nfrSnapshot,
} from "../../../application/backlog";
import type { NfrRecord } from "../../../application/backlog";
import { openNote } from "../../../application/notes";
import { projectChanges, projectMembers, projectSnapshot } from "../../../application/projects";
import type { ProjectId } from "../../../application/projects";
import { PROJECT_STORY_MAPS } from "../../../application/story-maps";
import { nfrStandards } from "../../../domain/backlog";
import type { NfrId } from "../../../domain/backlog";
import { useRememberWorkspaceOrigin, useRestoreWorkspacePosition } from "../../projects";
import {
  ErrorNotice,
  useCommand,
  useHistory,
  useMessages,
  useNavigate,
  useRouting,
  useStream,
} from "../../shell";
import BacklogTabs from "../BacklogTabs.vue";
import NfrCatalogFilters from "./NfrCatalogFilters.vue";
import NfrCatalogResults from "./NfrCatalogResults.vue";
import NfrEditor from "./NfrEditor.vue";
import NfrImport from "./NfrImport.vue";
import { useNfrFilters, visibleNfrRecords } from "./filters";

const {
  project,
  selected = undefined,
  fromItem = undefined,
} = defineProps<{
  readonly project: ProjectId;
  readonly selected?: NfrId | undefined;
  readonly fromItem?: string | undefined;
}>();
const texts = useMessages().backlog;
const text = texts.nfr;
const { history } = useRouting();
const { back } = useHistory();
const navigate = useNavigate();
const remember = useRememberWorkspaceOrigin();
const restore = useRestoreWorkspacePosition();
const catalog = useStream(nfrSnapshot(project), nfrChanges(project));
const projects = useStream(projectSnapshot, projectChanges);
const members = computed(() => {
  const current = projects.value.projects.find(({ id }) => id === project);
  return current ? (projectMembers(current) ?? []) : [];
});
const current = shallowRef<NfrRecord>();
watch(
  [() => selected, catalog],
  ([id, snapshot], previous) => {
    if (id !== previous?.[0]) current.value = undefined;
    const record = snapshot.records.find((entry) => entry.id === id);
    if (record) current.value = record;
  },
  { immediate: true },
);
const damaged = computed(() => catalog.value.invalid.find(({ id }) => id === selected));
const unavailable = computed(() => selected && catalog.value.ready && !current.value);
const filters = useNfrFilters(project);
const filtered = computed(() => Boolean(filters.query || filters.category));
const rows = computed(() =>
  visibleNfrRecords(catalog.value.records, members.value, text.category, filters),
);
const create = ref(false);
const editing = computed(() => create.value || current.value);
const importing = ref(false);
const feedback = ref("");
const panel = ref<HTMLElement>();
const native = useCommand(openNote);
let creator: HTMLElement | undefined;
let importer: HTMLElement | undefined;
let focusId: NfrId | undefined;

function createNfr(event: MouseEvent) {
  creator = event.currentTarget as HTMLElement;
  create.value = true;
}

function importNfrs(event: MouseEvent) {
  importer = event.currentTarget as HTMLElement;
  feedback.value = "";
  importing.value = true;
}

function closeImport() {
  importing.value = false;
  importer?.focus({ preventScroll: true });
}

function imported(created: number, skipped: number) {
  if (created) reset();
  feedback.value = text.imported(created, skipped);
}

function reset() {
  filters.query = "";
  filters.category = "";
}

async function open(id: NfrId, event: MouseEvent) {
  remember(event.currentTarget as HTMLElement);
  if (!(await navigate(nfrCatalogRoute(project, id)))) remember(undefined);
}

function focusRecord() {
  if (create.value || selected || !focusId) return;
  const element = panel.value?.querySelector<HTMLElement>(`[data-pe-focus-key="nfr-${focusId}"]`);
  if (element) {
    element.focus({ preventScroll: true });
    focusId = undefined;
  }
}

async function closeEditor(saved?: NfrId) {
  if (saved) {
    if (!rows.value.some(({ id }) => id === saved)) reset();
    focusId = saved;
  }
  if (create.value) {
    create.value = false;
    if (!saved) creator?.focus({ preventScroll: true });
  } else if (selected) {
    if (hasScopedOrigin()) await back();
    else {
      focusId ??= selected;
      await navigate(nfrCatalogRoute(project));
    }
  }
  await nextTick();
  focusRecord();
}

function hasScopedOrigin() {
  const previous = history.value.back.at(-1);
  if (!previous || !("projectId" in previous) || previous.projectId !== project) return false;
  if (previous.name === PROJECT_STORY_MAPS) return previous.mapId !== undefined;
  if (previous.name === PROJECT_USE_CASE) return true;
  return (
    previous.name === PROJECT_BACKLOG && (previous.item || previous.tab === "nfrs" || fromItem)
  );
}

watch(
  rows,
  () => {
    restore();
    focusRecord();
  },
  { flush: "post" },
);
</script>

<template>
  <section ref="panel" class="pe-backlog pe-nfr-catalog" data-testid="nfr-catalog">
    <h1 tabindex="-1" class="pe:wrap-anywhere pe:text-2xl pe:font-semibold">{{ texts.title }}</h1>
    <div class="pe-backlog-actions pe:justify-between">
      <BacklogTabs active="nfrs" :project="project" />
      <div class="pe-backlog-actions">
        <UButton
          type="button"
          variant="soft"
          color="neutral"
          data-testid="nfr-import"
          data-pe-focus-key="nfr-import"
          :label="text.import"
          @click="importNfrs"
        />
        <UButton
          type="button"
          data-testid="nfr-create"
          data-pe-focus-key="nfr-create"
          :label="text.create"
          @click="createNfr"
        />
      </div>
    </div>
    <div>
      <h2 class="pe:text-lg pe:font-semibold">{{ text.heading }}</h2>
      <p class="pe:text-muted">{{ text.intro }}</p>
    </div>
    <NfrCatalogFilters v-model:query="filters.query" v-model:category="filters.category" />
    <p v-if="feedback" role="status" data-testid="nfr-feedback">{{ feedback }}</p>
    <NfrCatalogResults
      :snapshot="catalog"
      :rows="rows"
      :members="members"
      :filtered="filtered"
      @reset="reset"
      @open="open"
      @repair="native.run"
    />
    <div v-if="unavailable" class="pe:grid pe:gap-1" data-testid="nfr-missing">
      <p role="alert">{{ text.missing }}</p>
      <UButton
        v-if="damaged"
        type="button"
        variant="soft"
        :label="text.openNote"
        @click="native.run(damaged.path)"
      />
      <UButton type="button" variant="ghost" :label="text.back" @click="closeEditor()" />
    </div>
    <ErrorNotice v-if="native.message.value" :message="native.message.value" />
    <details class="pe-nfr-reference">
      <summary>{{ text.standards }}</summary>
      <p v-for="(name, standard) in nfrStandards" :key="standard">
        <strong>{{ name }}</strong> · {{ text.groups[standard] }}
      </p>
      <p>{{ text.descriptive }}</p>
    </details>
    <NfrEditor
      v-if="editing"
      :key="current?.id ?? 'new'"
      :project="project"
      :record="current"
      :members="members"
      @dismiss="closeEditor"
    />
    <NfrImport v-if="importing" :project="project" @dismiss="closeImport" @imported="imported" />
  </section>
</template>
