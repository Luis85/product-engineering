<script setup lang="ts">
import UButton from "@nuxt/ui/components/Button.vue";
import { computed, nextTick, ref, shallowRef, watch } from "vue";
import {
  approvePbi,
  PROJECT_BACKLOG,
  backlogChanges,
  backlogRoute,
  inspectPbiPreparation,
  readPbiDetail,
} from "../../application/backlog";
import type {
  BacklogItem,
  BacklogSnapshot,
  PbiDetail,
  PbiPreparation,
  PbiPreparationGap,
  PbiTab,
} from "../../application/backlog";
import { knowledgeDetailRoute, projectKnowledgeRoute } from "../../application/knowledge";
import type { KnowledgeRecord } from "../../application/knowledge";
import { openNote } from "../../application/notes";
import { projectAdministrationRoute } from "../../application/projects";
import type { ProjectId } from "../../application/projects";
import type { KnowledgeId } from "../../domain/knowledge";
import { useRememberWorkspaceOrigin, useRestoreWorkspacePosition } from "../projects";
import {
  ErrorNotice,
  useAsyncStream,
  useCommand,
  useHistory,
  useMessages,
  useNavigate,
  useQuery,
  useRouting,
} from "../shell";
import PbiCompanions from "./PbiCompanions.vue";
import PbiContext from "./PbiContext.vue";
import PbiCriteria from "./PbiCriteria.vue";
import PbiEditForm from "./PbiEditForm.vue";
import PbiGit from "./PbiGit.vue";
import PbiHeader from "./PbiHeader.vue";
import PbiLinks from "./PbiLinks.vue";
import PbiOverview from "./PbiOverview.vue";
import PbiReadiness from "./PbiReadiness.vue";
import PbiTabs from "./PbiTabs.vue";
import { usePbiPreferences } from "./pbi-tabs";

const {
  projectId,
  pbiId,
  initialTab = undefined,
} = defineProps<{
  readonly projectId: ProjectId;
  readonly pbiId: string;
  readonly initialTab?: PbiTab | undefined;
}>();
const text = useMessages().backlog;
const navigate = useNavigate();
const { history } = useRouting();
const { back } = useHistory();
const boardOrigin = computed(() => {
  const previous = history.value.back.at(-1);
  return (
    previous?.name === PROJECT_BACKLOG &&
    previous.projectId === projectId &&
    previous.tab !== "list" &&
    !previous.item
  );
});
const restore = useRestoreWorkspacePosition();
const remember = useRememberWorkspaceOrigin();
const { tab, gaps } = usePbiPreferences(projectId, pbiId);
if (initialTab) tab.value = initialTab;
const snapshot = useAsyncStream<BacklogSnapshot, never>(
  { ready: false, items: [], duplicates: [] },
  backlogChanges(projectId),
);
const read = useQuery(readPbiDetail);
const native = useCommand(openNote);
const approve = useCommand(approvePbi);
const inspectPreparation = useQuery(inspectPbiPreparation);
const preparing = computed(() => read.pending.value || inspectPreparation.pending.value);
const detail = shallowRef<PbiDetail>();
const preparation = shallowRef<PbiPreparation>();
const editor = shallowRef<InstanceType<typeof PbiEditForm>>();
const panel = ref<HTMLElement>();
const message = computed(
  () =>
    read.message.value ??
    native.message.value ??
    approve.message.value ??
    inspectPreparation.message.value,
);
const parent = computed(() =>
  snapshot.value.items.find(({ key }) => key === detail.value?.edit.item.parent),
);

async function refresh() {
  const result = await read.run(projectId, pbiId);
  if (result._tag === "success") detail.value = result.value;
  else if (result._tag === "failure") detail.value = undefined;
}
watch(
  snapshot,
  (current) => {
    if (current.ready) void refresh();
  },
  { immediate: true },
);
watch([detail, preparation], () => void nextTick(() => restore()));
watch(detail, (current) => {
  if (current) void refreshPreparation();
});

async function refreshPreparation() {
  if (!detail.value) return;
  const result = await inspectPreparation.run(detail.value);
  if (result._tag === "success") preparation.value = result.value;
  else if (result._tag === "failure") preparation.value = undefined;
}

async function chooseTab(next: PbiTab, control?: HTMLElement) {
  if (next !== tab.value && (await (editor.value?.guard(control) ?? true))) {
    tab.value = next;
    await nextTick();
    panel.value
      ?.querySelector<HTMLElement>(`[data-testid="pbi-tab-${next}"]`)
      ?.focus({ preventScroll: true });
  }
}

async function openSource(record: KnowledgeRecord, event: MouseEvent) {
  return openKnowledge(record.id, event);
}

async function openKnowledge(id: KnowledgeId, event: MouseEvent) {
  remember(event.currentTarget as HTMLElement);
  const opened = await navigate(
    knowledgeDetailRoute(projectId, id, {
      section: "usecase",
      reference: { kind: "item", recordId: pbiId },
    }),
  );
  if (!opened) remember(undefined);
}

async function openParent(item: BacklogItem, event: MouseEvent) {
  remember(event.currentTarget as HTMLElement);
  if (!(await navigate(backlogRoute(projectId, item.id)))) remember(undefined);
}

const preparationTabs: Partial<Record<PbiPreparationGap["reason"], PbiTab>> = {
  prd: "edit",
  research: "edit",
  adr: "edit",
  criteria: "criteria",
  scenario: "criteria",
  gitPending: "git",
  gitUnavailable: "git",
};

async function nextAction(gap: PbiPreparationGap, event: MouseEvent) {
  const control = event.currentTarget as HTMLElement;
  if (gap.record) return openSource(gap.record, event);
  const destination = preparationTabs[gap.reason];
  if (destination) return chooseTab(destination, control);
  if (gap.reason === "vision") return navigate(projectKnowledgeRoute(projectId));
  if (gap.reason === "repository")
    return navigate(projectAdministrationRoute(projectId, "project"));
  if (gap.reason === "approval") return approveCurrent(control);
}

async function approveCurrent(control: HTMLElement) {
  if (detail.value && (await (editor.value?.guard(control) ?? true))) {
    const result = await approve.run(detail.value);
    if (result._tag === "success") await refresh();
  }
}

function cancelEdit() {
  tab.value = "usecase";
  void nextTick(() =>
    panel.value
      ?.querySelector<HTMLElement>('[data-testid="pbi-tab-usecase"]')
      ?.focus({ preventScroll: true }),
  );
}

async function openFile(event: MouseEvent) {
  const control = event.currentTarget as HTMLElement;
  if (detail.value && (await (editor.value?.guard(control) ?? true))) {
    await native.run(detail.value.edit.item.path);
  }
}
</script>

<template>
  <section ref="panel" class="pe-backlog pe-pbi" data-testid="pbi-detail">
    <UButton
      type="button"
      variant="ghost"
      class="pe:justify-self-start"
      data-testid="pbi-return"
      :label="boardOrigin ? text.board.returnToBoard : text.pbiReturn"
      @click="boardOrigin ? back() : navigate(backlogRoute(projectId))"
    />
    <PbiHeader
      v-if="detail"
      :detail="detail"
      :parent="parent"
      :native-pending="native.pending.value"
      @open="openFile"
      @parent="openParent"
    />
    <h1 v-else tabindex="-1" class="pe:text-2xl pe:font-semibold">{{ pbiId }}</h1>
    <ErrorNotice v-if="message" :message="message" />
    <PbiContext
      v-if="detail"
      :detail="detail"
      @open="openKnowledge"
      @links="chooseTab('links', $event.currentTarget as HTMLElement)"
    />
    <PbiReadiness
      v-if="detail"
      :preparation="preparation"
      :pending="preparing"
      :authorizing="approve.pending.value"
      :expanded="gaps ?? tab === 'usecase'"
      @act="nextAction"
      @refresh="refresh"
      @expand="gaps = $event"
    />
    <PbiTabs
      v-if="detail"
      :active="tab"
      @select="(next, event) => chooseTab(next, event.currentTarget as HTMLElement)"
    >
      <template #companions>
        <PbiCompanions :project="projectId" :item="detail.edit.item" :snapshot="snapshot" />
      </template>
      <template #criteria>
        <PbiCriteria :project="projectId" :entry="detail.edit" @saved="refresh" />
      </template>
      <template #links>
        <PbiLinks :detail="detail" @open="openSource" @edit="chooseTab('edit')" @saved="refresh" />
      </template>
      <template #edit>
        <PbiEditForm
          ref="editor"
          :detail="detail"
          @cancel="cancelEdit"
          @saved="refresh"
          @reloaded="detail = $event"
        />
      </template>
      <template #git>
        <PbiGit :project-id="projectId" :pbi-id="pbiId" @committed="refreshPreparation" />
      </template>
      <template #usecase>
        <PbiOverview :detail="detail" :items="snapshot.items" @tab="chooseTab" />
      </template>
    </PbiTabs>
  </section>
</template>
