<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, shallowRef, watch } from "vue";
import {
  backlogBoardRoute,
  backlogChanges,
  backlogRoute,
  nfrCatalogRoute,
  moveBoardCard,
  openBacklogBase,
  pbiBoardStage,
  pbiDetailRoute,
  readBacklogItem,
} from "../../application/backlog";
import type {
  BacklogEdit,
  BacklogItem,
  BacklogSnapshot,
  BacklogTab,
  PbiPreparationGap,
  PbiTab,
} from "../../application/backlog";
import {
  knowledgeBodyChanges,
  knowledgeBodySnapshot,
  knowledgeDetailRoute,
} from "../../application/knowledge";
import type { KnowledgeRecord } from "../../application/knowledge";
import { projectAdministrationRoute } from "../../application/projects";
import type { ProjectId } from "../../application/projects";
import { boardStages, mappedBoardStage, normalizedBoardStage } from "../../domain/backlog";
import type { BoardStage } from "../../domain/backlog";
import { useRememberWorkspaceOrigin, useRestoreWorkspacePosition } from "../projects";
import {
  ErrorNotice,
  useAsyncStream,
  useCommand,
  useMessages,
  useNavigate,
  useQuery,
  useStream,
} from "../shell";
import BacklogBoardCard from "./BacklogBoardCard.vue";
import BacklogBoardLane from "./BacklogBoardLane.vue";
import BacklogResults from "./BacklogResults.vue";
import BacklogEditor from "./BacklogEditor.vue";
import BacklogToolbar from "./BacklogToolbar.vue";
import { boardEdges, useBoardFolds } from "./board-preferences";
import { resetBacklogFilters, useBacklogPreferences } from "./preferences";

const { project } = defineProps<{ readonly project: ProjectId }>();
const text = useMessages().backlog;
const navigate = useNavigate();
const remember = useRememberWorkspaceOrigin();
const restore = useRestoreWorkspacePosition();
const panel = ref<HTMLElement>();
const scroll = ref<HTMLElement>();
const preferences = useBacklogPreferences(project);
const { folded, toggle } = useBoardFolds(project, panel);
const snapshot = useAsyncStream<BacklogSnapshot, never>(
  { ready: false, items: [], duplicates: [] },
  backlogChanges(project),
);
const bodyChange = useStream(knowledgeBodySnapshot, knowledgeBodyChanges);
const base = useCommand(openBacklogBase);
const moveCommand = useCommand(moveBoardCard);
const read = useQuery(readBacklogItem);
const edit = shallowRef<BacklogEdit>();
const editor = ref(false);
const editorBase = computed(() => (editor.value ? snapshot.value.base : undefined));
const editorKey = computed(() => edit.value?.item.key ?? "create");
const dragItem = shallowRef<BacklogItem>();
const dragOver = ref<BoardStage>();
const focusMove = ref<{ stage: BoardStage; id: string }>();
const focusCreated = ref<string>();
const status = ref("");
let trigger: HTMLElement | undefined;

const items = computed(() => new Map(snapshot.value.items.map((item) => [item.key, item])));
const pbis = computed(() =>
  snapshot.value.items.filter(({ kind, conflict }) => kind === "UC" && !conflict),
);
const statusLabels = computed(() =>
  Object.fromEntries(
    boardStages.map((stage) => [
      mappedBoardStage(stage, snapshot.value.base?.states ?? []),
      text.board.stages[stage],
    ]),
  ),
);
const statuses = computed(() => [
  ...new Set([...Object.keys(statusLabels.value), ...[preferences.status].filter(Boolean)]),
]);
const priorities = computed(() => snapshot.value.base?.priorities ?? []);
const emptyMessage = computed(() => (pbis.value.length ? text.noMatches : text.empty));
const visible = computed(() => pbis.value.filter(matchesFilters));
const columns = computed(() =>
  boardStages.map((stage) => ({
    stage,
    cards: visible.value
      .filter((item) => pbiBoardStage(item) === stage)
      .map((item) => ({ item, feature: parentOf(item)?.title })),
    foldable: boardEdges.some((edge) => stage === edge),
  })),
);
const message = computed(
  () => base.message.value ?? moveCommand.message.value ?? read.message.value,
);

function parentOf(item: BacklogItem | undefined) {
  return item?.parent ? items.value.get(item.parent) : undefined;
}

function matchesStage(item: BacklogItem) {
  if (!preferences.status) return true;
  const stage = normalizedBoardStage(preferences.status);
  return stage ? pbiBoardStage(item) === stage : item.state === preferences.status;
}

function matchesFilters(item: BacklogItem) {
  if (!matchesStage(item)) return false;
  if (preferences.priority && item.priority !== preferences.priority) return false;
  const feature = parentOf(item);
  const epic = parentOf(feature);
  const labels = [item.id, item.title, item.owner, feature?.id, feature?.title, epic?.title];
  return labels
    .join(" ")
    .toLocaleLowerCase()
    .includes(preferences.query.trim().toLocaleLowerCase());
}

function control(key: string) {
  return [...(panel.value?.querySelectorAll<HTMLElement>("[data-pe-focus-key]") ?? [])].find(
    (element) => element.dataset.peFocusKey === key,
  );
}

watch(scroll, (current) => {
  if (current) current.scrollLeft = preferences.boardScroll;
});
onBeforeUnmount(() => {
  if (scroll.value) preferences.boardScroll = scroll.value.scrollLeft;
});

function reset() {
  Object.assign(preferences, resetBacklogFilters());
}

function selectTab(tab: BacklogTab) {
  if (tab === "list") return navigate(backlogRoute(project));
  if (tab === "nfrs") return navigate(nfrCatalogRoute(project));
}

function focusCard(key: string) {
  const target = control(key);
  target?.focus({ preventScroll: true });
  target?.scrollIntoView({ block: "nearest", inline: "nearest" });
  return target;
}

function restoreCardFocus() {
  if (editor.value) return;
  if (focusCreated.value && focusCard("board-card-" + focusCreated.value))
    focusCreated.value = undefined;
  restoreMoveFocus();
}

function restoreMoveFocus() {
  const moved = focusMove.value;
  if (!moved) return;
  const item = items.value.get(moved.id);
  if (!item || pbiBoardStage(item) !== moved.stage) return;
  const key = folded.value.has(moved.stage)
    ? "board-fold-" + moved.stage
    : "board-move-" + moved.id;
  if (!focusCard(key)) control("backlog-search")?.focus({ preventScroll: true });
  focusMove.value = undefined;
}
watch(
  [visible, focusCreated, focusMove],
  () => {
    restore();
    restoreCardFocus();
  },
  { flush: "post" },
);
watch(scroll, () => restore(), { flush: "post" });

function quickAdd(origin: HTMLElement) {
  trigger = origin;
  edit.value = undefined;
  editor.value = true;
}

async function closeEditor(reason?: "native-note") {
  editor.value = false;
  edit.value = undefined;
  await nextTick();
  if (reason) return;
  if (focusCreated.value) restoreCardFocus();
  else trigger?.focus({ preventScroll: true });
}

function saved(id: string, _moved: boolean, item?: BacklogItem) {
  if (!item) return;
  if (!matchesFilters(item)) reset();
  const stage = pbiBoardStage(item);
  if (folded.value.has(stage)) toggle(stage);
  focusCreated.value = id;
}

async function open(item: BacklogItem, origin: HTMLElement, tab?: PbiTab) {
  if (item.adopted && item.id) {
    remember(origin);
    if (!(await navigate(pbiDetailRoute(project, item.id, tab)))) remember(undefined);
  } else {
    trigger = origin;
    const outcome = await read.run(project, item.key);
    if (outcome._tag === "success") {
      edit.value = outcome.value;
      editor.value = true;
    }
  }
}

async function adopted(item: BacklogItem) {
  const outcome = await read.run(project, item.key);
  if (outcome._tag === "success") {
    edit.value = outcome.value;
    focusCreated.value = item.key;
  }
}

function prepare(item: BacklogItem, origin: HTMLElement, gap: PbiPreparationGap) {
  const tab =
    gap.reason === "criteria" || gap.reason === "scenario"
      ? "criteria"
      : gap.reason === "prd" || gap.reason === "research" || gap.reason === "adr"
        ? "edit"
        : "usecase";
  return open(item, origin, tab);
}

async function git(item: BacklogItem, origin: HTMLElement, record?: KnowledgeRecord) {
  if (!record) return open(item, origin, "git");
  remember(origin);
  if (!(await navigate(knowledgeDetailRoute(project, record.id, { section: "board-git" }))))
    remember(undefined);
}

async function move(item: BacklogItem, stage: BoardStage) {
  if (pbiBoardStage(item) === stage || moveCommand.pending.value) return;
  const outcome = await moveCommand.run(project, item.key, item.state, stage);
  if (outcome._tag === "success") {
    status.value = text.board.moved(item.key, text.board.stages[stage]);
    focusMove.value = { stage, id: item.key };
  }
}

function dragStart(item: BacklogItem, event: DragEvent) {
  if (!item.adopted || !event.dataTransfer || moveCommand.pending.value) return;
  dragItem.value = item;
  event.dataTransfer.setData("text/plain", item.key);
  event.dataTransfer.effectAllowed = "move";
}

function dragEnd() {
  dragItem.value = undefined;
  dragOver.value = undefined;
}

function over(stage: BoardStage, event: DragEvent) {
  if (!dragItem.value || !event.dataTransfer) return;
  event.preventDefault();
  event.dataTransfer.dropEffect = "move";
  dragOver.value = stage;
}

function drop(stage: BoardStage, event: DragEvent) {
  const item = dragItem.value;
  dragEnd();
  if (!item || event.dataTransfer?.getData("text/plain") !== item.key) return;
  event.preventDefault();
  void move(item, stage);
}
</script>

<template>
  <section ref="panel" class="pe-backlog pe-kanban" data-testid="backlog-board">
    <h1 tabindex="-1" class="pe:wrap-anywhere pe:text-2xl pe:font-semibold">{{ text.title }}</h1>
    <BacklogToolbar
      active="board"
      :model-value="preferences"
      :can-create="Boolean(snapshot.base)"
      :can-undo="false"
      :states="statuses"
      :status-labels="statusLabels"
      :priorities="priorities"
      @select="selectTab"
      @base="base.run(project)"
      @reset="reset"
    />
    <ErrorNotice v-if="message" :message="message" />
    <BacklogResults
      :snapshot="snapshot"
      @configure="navigate(projectAdministrationRoute(project, 'project'))"
    >
      <div class="pe:flex pe:flex-wrap pe:items-center pe:gap-2">
        <h2 class="pe:font-semibold">{{ text.board.title }}</h2>
        <span class="pe:text-sm pe:text-muted">{{ text.board.count(visible.length) }}</span>
      </div>
      <p v-if="!visible.length" role="status" class="pe:text-muted">
        {{ emptyMessage }}
      </p>
      <span role="status" class="pe:sr-only">{{ status }}</span>
      <div
        ref="scroll"
        class="pe-board-scroll"
        data-testid="board-scroll"
        role="region"
        :aria-label="text.board.lanes"
        tabindex="0"
      >
        <div
          class="pe-board-grid"
          :data-backlog-folded="folded.has('Backlog')"
          :data-done-folded="folded.has('Done')"
        >
          <BacklogBoardLane
            v-for="{ stage, cards, foldable } in columns"
            :key="stage"
            :stage="stage"
            :count="cards.length"
            :foldable="foldable"
            :folded="folded.has(stage)"
            :drop-target="dragOver === stage"
            @over="over(stage, $event)"
            @drop="drop(stage, $event)"
            @fold="toggle(stage)"
            @create="quickAdd"
          >
            <BacklogBoardCard
              v-for="{ item, feature } in cards"
              :key="item.key"
              :item="item"
              :project="project"
              :feature="feature"
              :snapshot="snapshot"
              :body-change="bodyChange"
              :stage="stage"
              :busy="moveCommand.pending.value"
              @open="open(item, $event)"
              @prepare="(control, gap) => prepare(item, control, gap)"
              @git="(control, record) => git(item, control, record)"
              @move="move(item, $event)"
              @drag-start="dragStart(item, $event)"
              @drag-end="dragEnd"
            />
          </BacklogBoardLane>
        </div>
      </div>
    </BacklogResults>
    <BacklogEditor
      v-if="editorBase"
      :key="editorKey"
      :project="project"
      :base="editorBase"
      :items="snapshot.items"
      kind="UC"
      :edit="edit"
      @dismiss="closeEditor"
      @saved="saved"
      @adopted="adopted"
    />
  </section>
</template>
