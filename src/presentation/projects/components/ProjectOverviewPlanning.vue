<script setup lang="ts">
import UButton from "@nuxt/ui/components/Button.vue";
import UIcon from "@nuxt/ui/components/Icon.vue";
import { computed, nextTick, onMounted, ref, watch } from "vue";
import type { BacklogSnapshot } from "../../../application/backlog";
import {
  knowledgeChanges,
  knowledgeSnapshot,
  projectKnowledge,
} from "../../../application/knowledge";
import type { KnowledgeOrigin } from "../../../application/knowledge";
import type { Note } from "../../../application/notes";
import {
  overviewContexts,
  overviewPlanning,
  selectedOverviewContext,
} from "../../../application/projects";
import type { ProjectId } from "../../../application/projects";
import {
  storyMapsChanges,
  storyMapsRoute,
  storyMapsSnapshot,
  storySliceStories,
} from "../../../application/story-maps";
import type { StoryMapId } from "../../../domain/story-maps";
import { KnowledgeCreateDialog, useKnowledgeDraftNavigation } from "../../knowledge";
import { useMessages, useNavigate, useStream } from "../../shell";
import { StoryMapCreateDialog } from "../../story-maps";
import { planningRows } from "../overview-planning-rows";
import type { PlanningCreation } from "../overview-planning-rows";
import { useOverviewPreference } from "../overview-preferences";
import { useRememberWorkspaceOrigin, useRestoreWorkspacePosition } from "../workspace-position";
import ProjectOverviewStep from "./ProjectOverviewStep.vue";

const { projectId, backlog } = defineProps<{
  readonly projectId: ProjectId;
  readonly backlog: BacklogSnapshot;
}>();
const catalog = useMessages();
const text = catalog.projects.overviewPlanning;
const { openDraft } = useKnowledgeDraftNavigation();
const navigate = useNavigate();
const remember = useRememberWorkspaceOrigin();
const restore = useRestoreWorkspacePosition();
const library = useStream(knowledgeSnapshot, knowledgeChanges);
const maps = useStream(storyMapsSnapshot(projectId), storyMapsChanges(projectId));
const knowledge = computed(() => projectKnowledge(projectId, library.value.records));
const contexts = computed(() => overviewContexts(knowledge.value, maps.value.maps));
const { preference, select } = useOverviewPreference(projectId);
const selected = computed(() => selectedOverviewContext(contexts.value, preference.value));
const selection = computed({
  get: () => selected.value?.key,
  set: (key) => {
    if (key) void select(key);
  },
});
const planning = computed(() =>
  overviewPlanning(selected.value, knowledge.value, backlog.items, storySliceStories),
);
const ready = computed(() => library.value.ready && maps.value.ready && backlog.ready);
const status = computed(() => {
  if (library.value.failed || maps.value.failed)
    return { text: catalog.projects.unavailable, role: "alert" };
  if (!ready.value) return { text: catalog.projects.loading, role: "status" };
  return undefined;
});
const showSelector = computed(() => ready.value && contexts.value.length > 1);
const hasJobs = computed(() => knowledge.value.some(({ kind }) => kind === "jtbd"));
const showAnotherJob = computed(
  () => !status.value && hasJobs.value && planning.value.next !== "job",
);
const rows = computed(() => planningRows(projectId, planning.value, hasJobs.value, text));

watch(
  [selected, ready],
  ([context, available]) => {
    if (available && context && preference.value) void select(context.key);
  },
  { immediate: true },
);

const origin = { section: "overview" } as const;
const creation = ref<PlanningCreation>();
let trigger: HTMLElement | undefined;

const mapSource = computed(() => (creation.value === "map" ? planning.value.prd : undefined));
const knowledgeOrigin = computed<KnowledgeOrigin | undefined>(() => {
  const job = planning.value.jobs[0];
  return job && creation.value !== "jtbd"
    ? { kind: "job", recordId: job.id, projectId }
    : undefined;
});
const draft = computed(() => {
  const kind = creation.value;
  if (!kind || kind === "map") return undefined;
  const source = knowledgeOrigin.value;
  return {
    projectId,
    initialTemplate: kind,
    initialVision: planning.value.vision?.id,
    ...(source && { origin: source }),
  };
});

function start(kind: PlanningCreation, event: MouseEvent) {
  trigger = event.currentTarget as HTMLElement;
  creation.value = kind;
}

async function cancel() {
  creation.value = undefined;
  await nextTick();
  trigger?.focus({ preventScroll: true });
}

async function created(note: Note) {
  creation.value = undefined;
  await openDraft(note, projectId, origin, trigger);
}

async function mapClosed(id?: StoryMapId) {
  if (!id) return cancel();
  creation.value = undefined;
  remember(trigger);
  if (!(await navigate(storyMapsRoute(projectId, id)))) remember(undefined);
}

onMounted(() => restore());
watch(ready, () => restore("available"), { flush: "post" });
</script>

<template>
  <section
    class="pe-overview-panel"
    :aria-label="text.title"
    data-testid="project-overview-planning"
  >
    <header class="pe-overview-panel-head">
      <h2>{{ text.title }}</h2>
      <label v-if="showSelector" class="pe-overview-context">
        <span>{{ text.context }}</span>
        <span class="pe:relative pe:min-w-0 pe:max-w-[min(100%,28rem)] pe:text-default">
          <select
            v-model="selection"
            data-testid="overview-context"
            data-pe-focus-key="overview-context"
          >
            <option v-for="context in contexts" :key="context.key" :value="context.key">
              {{ `${context.record.displayId} · ${context.record.title}` }}
            </option>
          </select>
          <UIcon
            name="i-lucide-chevron-down"
            class="pe-overview-context-chevron pe:pointer-events-none pe:absolute pe:end-[0.55rem] pe:top-1/2 pe:size-4 pe:-translate-y-1/2"
            aria-hidden="true"
          />
        </span>
      </label>
    </header>
    <p v-if="status" :role="status.role">{{ status.text }}</p>
    <ol v-else class="pe-overview-steps">
      <ProjectOverviewStep
        v-for="(row, index) in rows"
        :key="row.id"
        :row="row"
        :active="row.id === planning.next"
        :position="index + 1"
        @create="start"
      />
    </ol>
    <div v-if="showAnotherJob" class="pe-overview-panel-footer">
      <UButton
        type="button"
        variant="ghost"
        size="sm"
        icon="i-lucide-plus"
        :label="text.anotherJob"
        data-pe-focus-key="overview-another-job"
        @click="start('jtbd', $event)"
      />
    </div>
    <StoryMapCreateDialog
      v-if="mapSource"
      :project-id="projectId"
      :prd-id="mapSource.id"
      :source-path="mapSource.path"
      @dismiss="mapClosed"
    />
    <KnowledgeCreateDialog
      v-else-if="draft"
      v-bind="draft"
      lock-template
      :on-created="created"
      @dismiss="cancel"
    />
  </section>
</template>
