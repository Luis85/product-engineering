<script setup lang="ts">
import UButton from "@nuxt/ui/components/Button.vue";
import UModal from "@nuxt/ui/components/Modal.vue";
import { computed, nextTick, ref, shallowRef, watch } from "vue";
import {
  backlogBoardRoute,
  backlogChanges,
  backlogRoute,
  moveBacklogItem,
  openBacklogBase,
  pbiDetailRoute,
  readBacklogItem,
  undoBacklogMove,
} from "../../application/backlog";
import type {
  BacklogEdit,
  BacklogItem,
  BacklogPlacement,
  BacklogSnapshot,
} from "../../application/backlog";
import { openNote } from "../../application/notes";
import { projectAdministrationRoute } from "../../application/projects";
import { backlogKinds, parentKind } from "../../domain/backlog";
import type { BacklogKind } from "../../domain/backlog";
import { DomainScopeLinks } from "../domain-model";
import { leafModalUi, useRememberWorkspaceOrigin, useRestoreWorkspacePosition } from "../projects";
import {
  ErrorNotice,
  useAsyncStream,
  useCommand,
  useMessages,
  useModal,
  useNavigate,
  useQuery,
} from "../shell";
import BacklogEditor from "./BacklogEditor.vue";
import BacklogListResults from "./BacklogListResults.vue";
import BacklogToolbar from "./BacklogToolbar.vue";
import { resetBacklogFilters, useBacklogPreferences, visibleBacklog } from "./preferences";

const { route } = defineProps<{ readonly route: ReturnType<typeof backlogRoute> }>();
const project = route.projectId;
const text = useMessages().backlog;
const navigate = useNavigate();
const restorePosition = useRestoreWorkspacePosition();
const rememberOrigin = useRememberWorkspaceOrigin();
const snapshot = useAsyncStream<BacklogSnapshot, never>(
  { ready: false, items: [], duplicates: [] },
  backlogChanges(project),
);
const preferences = useBacklogPreferences(project);
const rows = computed(() => visibleBacklog(snapshot.value.items, preferences));
const states = computed(() => [
  ...new Set([
    ...(snapshot.value.base?.states ?? []),
    ...(preferences.status ? [preferences.status] : []),
    ...snapshot.value.items.map(({ state }) => state).filter(Boolean),
  ]),
]);
const priorities = computed(() => snapshot.value.base?.priorities ?? []);
const read = useQuery(readBacklogItem);
const moveCommand = useCommand(moveBacklogItem);
const undo = useCommand(undoBacklogMove);
const base = useCommand(openBacklogBase);
const file = useCommand(openNote);
const message = computed(
  () =>
    read.message.value ??
    moveCommand.message.value ??
    undo.message.value ??
    base.message.value ??
    file.message.value,
);
const panel = ref<HTMLElement>();
const choice = ref(false);
const editor = ref<BacklogKind>();
const revision = ref(0);
const entry = shallowRef<BacklogEdit>();
const domainTarget = computed(() => {
  const item = entry.value?.item;
  return item?.adopted && item.id ? { projectId: project, id: item.id } : undefined;
});
const creationTypes = computed(() =>
  backlogKinds.filter(
    (kind) =>
      kind === "UC" ||
      kind === "EP" ||
      snapshot.value.items.some((item) => item.kind === parentKind(kind) && !item.conflict),
  ),
);
let trigger: HTMLElement | undefined;
let focusAfterClose: string | undefined;
let nextKind: BacklogKind | undefined;
let sawRouteItem: string | undefined;
const chooser = useModal(
  choice,
  () => {
    editor.value = nextKind;
    if (!nextKind) trigger?.focus({ preventScroll: true });
    nextKind = undefined;
  },
  () => {
    choice.value = false;
  },
);

function choose(control: HTMLElement) {
  trigger = control;
  choice.value = true;
}

function create(kind: BacklogKind) {
  entry.value = undefined;
  nextKind = kind;
  choice.value = false;
}

function toggle(key: string) {
  if (preferences.collapsed.has(key)) preferences.collapsed.delete(key);
  else preferences.collapsed.add(key);
}

function showBase() {
  return base.run(project);
}

function configureBase() {
  return navigate(projectAdministrationRoute(project, "project"));
}

async function open(item: BacklogItem, control?: HTMLElement, edit = false) {
  if (!edit && item.kind === "UC" && item.adopted && !item.conflict && item.id) {
    rememberOrigin(control);
    await navigate(pbiDetailRoute(project, item.id));
    return;
  }
  trigger = control;
  if (item.conflict) {
    await file.run(item.path);
    return;
  }
  const outcome = await read.run(project, item.key);
  if (outcome._tag === "success") {
    entry.value = outcome.value;
    editor.value = outcome.value.item.kind;
  }
}

watch(
  [() => route.item, () => snapshot.value.ready],
  ([item, ready]) => {
    if (!ready || item === sawRouteItem) return;
    sawRouteItem = item;
    if (item) {
      const source = snapshot.value.items.find(({ id }) => id === item);
      if (source) void open(source, rowControl(source.key), true);
      else void read.run(project, item);
    }
  },
  { immediate: true },
);
watch(rows, () => restorePosition(), { flush: "post" });

function rowControl(key: string) {
  return [...(panel.value?.querySelectorAll<HTMLElement>("[data-pe-focus-key]") ?? [])].find(
    (element) => element.dataset.peFocusKey === "backlog-" + key,
  );
}

function saved(key: string, moved: boolean) {
  if (moved) preferences.canUndo = true;
  if (entry.value) return;
  Object.assign(preferences, resetBacklogFilters());
  preferences.collapsed.clear();
  focusAfterClose = key;
}

async function adopted(item: BacklogItem) {
  const outcome = await read.run(project, item.key);
  if (outcome._tag !== "success") return;
  entry.value = outcome.value;
  revision.value += 1;
  focusAfterClose = item.key;
}

async function dismiss(reason?: "native-note") {
  const item = route.item;
  const handoff = reason === "native-note";
  editor.value = undefined;
  entry.value = undefined;
  if (handoff) focusAfterClose = undefined;
  if (item) await navigate(backlogRoute(project));
  if (handoff) return;
  await nextTick();
  const preferred = focusAfterClose ?? item;
  const control = preferred ? rowControl(preferred) : undefined;
  (control ?? trigger)?.focus({ preventScroll: true });
  if (control) focusAfterClose = undefined;
}

watch(
  rows,
  () => {
    if (editor.value || !focusAfterClose) return;
    const control = rowControl(focusAfterClose);
    if (!control) return;
    control.focus({ preventScroll: true });
    focusAfterClose = undefined;
  },
  { flush: "post" },
);

async function move(key: string, placement: BacklogPlacement) {
  const result = await moveCommand.run(project, key, placement);
  if (result._tag === "success") {
    preferences.canUndo = true;
    rowControl(key)?.focus({ preventScroll: true });
  }
}

async function undoMove() {
  const result = await undo.run(project);
  if (result._tag === "success") preferences.canUndo = false;
}
</script>

<template>
  <section ref="panel" class="pe-backlog" data-testid="backlog-list">
    <h1 tabindex="-1" class="pe:wrap-anywhere pe:text-2xl pe:font-semibold">{{ text.title }}</h1>
    <BacklogToolbar
      :tabs="['board', 'list']"
      active="list"
      :model-value="preferences"
      :can-create="Boolean(snapshot.base)"
      :can-undo="preferences.canUndo"
      :states="states"
      :priorities="priorities"
      @select="(tab) => tab === 'board' && navigate(backlogBoardRoute(project, true))"
      @create="choose"
      @undo="undoMove"
      @base="showBase"
      @reset="Object.assign(preferences, resetBacklogFilters())"
    />
    <ErrorNotice v-if="message" :message="message" />
    <BacklogListResults
      :snapshot="snapshot"
      :rows="rows"
      :level="preferences.level"
      @open="open"
      @toggle="toggle"
      @move="move"
      @configure="configureBase"
    />
    <UModal
      v-model:open="choice"
      :title="text.create"
      :description="text.chooseType"
      :content="chooser"
      :ui="leafModalUi"
    >
      <template #body>
        <div class="pe-backlog-actions">
          <UButton
            v-for="kind in creationTypes"
            :key="kind"
            type="button"
            variant="soft"
            :data-autofocus="kind === 'UC' || undefined"
            :data-testid="'backlog-create-' + kind"
            :label="text.createType(text.types[kind])"
            @click="create(kind)"
          />
        </div>
      </template>
    </UModal>
    <BacklogEditor
      v-if="editor && snapshot.base"
      :key="revision"
      :project="project"
      :base="snapshot.base"
      :items="snapshot.items"
      :kind="editor"
      :edit="entry"
      :level="preferences.level"
      @dismiss="dismiss"
      @saved="saved"
      @adopted="adopted"
    >
      <template #links>
        <DomainScopeLinks v-if="domainTarget" :item="domainTarget" />
      </template>
    </BacklogEditor>
  </section>
</template>
