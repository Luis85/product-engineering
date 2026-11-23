<script setup lang="ts">
import { computed, nextTick, onScopeDispose, ref, watch } from "vue";
import { knowledgeGitSource } from "../../application/knowledge";
import { ArtifactGitActions, ArtifactGitCommit, ArtifactGitHistory, useArtifactGit } from "../git";
import type {
  ProjectId,
  ProjectRecordRoute,
  ProjectSearchRecord,
} from "../../application/projects";
import type { Route } from "../../application/routes";
import { useRestoreWorkspacePosition } from "../projects";
import { DomainKnowledgeContribution } from "../domain-model";
import { useMessages, useNavigationGuard } from "../shell";
import KnowledgeDraftStatus from "./KnowledgeDraftStatus.vue";
import KnowledgeLeaveDialog from "./KnowledgeLeaveDialog.vue";
import KnowledgeMarkdown from "./KnowledgeMarkdown.vue";
import KnowledgeNoteEditor from "./KnowledgeNoteEditor.vue";
import KnowledgeNoteHeader from "./KnowledgeNoteHeader.vue";
import KnowledgeNoteMetadata from "./KnowledgeNoteMetadata.vue";
import KnowledgeNoteTabs from "./KnowledgeNoteTabs.vue";
import KnowledgeReferences from "./KnowledgeReferences.vue";
import KnowledgeRelatedNotes from "./KnowledgeRelatedNotes.vue";
import { useKnowledgeDraftNavigation } from "./draft-navigation";
import { useKnowledgeDraft } from "./note-draft";

const { record, resolved } = defineProps<{
  readonly record: ProjectRecordRoute;
  readonly resolved:
    ProjectSearchRecord<Extract<Route, { readonly projectId: ProjectId }>> | undefined;
}>();
const text = useMessages().knowledge;
const { takeDraft } = useKnowledgeDraftNavigation();
const handoff = ref(takeDraft(record));
const autofocusDraft = Boolean(handoff.value);
watch(
  () => resolved?.notePath,
  (indexed) => {
    if (indexed) handoff.value = undefined;
  },
  { immediate: true },
);
const path = computed(() => resolved?.notePath ?? handoff.value);
const {
  note,
  persistedApproval,
  markdown,
  fields,
  dirty,
  saved,
  conflict,
  saveFailed,
  invalidField,
  loading,
  loadingError,
  saving,
  save,
  reload,
} = useKnowledgeDraft(record, () => path.value);
const restorePosition = useRestoreWorkspacePosition();
watch(note, () => restorePosition(), { flush: "post", once: true });
const surface = ref<HTMLElement>();
const editor = ref<InstanceType<typeof KnowledgeNoteEditor>>();
const pane = ref<"content" | "editing" | "references" | "history">("content");
const leaving = ref(false);
const title = computed(() => note.value?.title ?? resolved?.title ?? text.title);
const references = computed(() => fields.value.references ?? note.value?.values.references ?? []);
const canEditReferences = computed(() => Boolean(note.value?.editable) && !saving.value);
const canDerive = computed(() => !dirty.value && !saving.value);
const showSave = computed(() => pane.value === "editing" || dirty.value);
const hasDomain = computed(() => note.value?.kind === "entity" || note.value?.kind === "prd");
const git = useArtifactGit(() => knowledgeGitSource(record));
let gitTrigger: HTMLElement | undefined;

function showWorkingChanges() {
  pane.value = "history";
  void git.select();
}

function openGitCommit(event: Event) {
  if (git.beginCommit()) gitTrigger = event.currentTarget as HTMLElement;
}

async function saveThenCommit(event: Event) {
  const trigger = event.currentTarget as HTMLElement;
  if (!(await save())) return;
  const result = await git.refresh();
  if (result._tag === "success" && git.beginCommit()) gitTrigger = trigger;
}

function restoreGitFocus() {
  const oid = git.announced.value;
  const next = oid && surface.value?.querySelector<HTMLElement>(`[data-git-oid="${oid}"]`);
  const target = next || (gitTrigger?.isConnected && gitTrigger);
  if (target) target.focus({ preventScroll: true });
  else if (editor.value) void editor.value.focus();
  else surface.value?.querySelector<HTMLElement>('[data-testid="knowledge-history-tab"]')?.focus();
}

watch(
  [() => note.value?.path, () => note.value?.text],
  ([savedPath]) => {
    if (savedPath) void git.refresh();
  },
  { immediate: true },
);
let answer: ((leave: boolean) => void) | undefined;
let refocus = false;

useNavigationGuard(() => {
  if (saving.value || git.committing.value) return false;
  if (!dirty.value) return true;
  leaving.value = true;
  return new Promise<boolean>((resolve) => {
    answer = resolve;
  });
});
onScopeDispose(() => answer?.(false));

function restoreEditorFocus() {
  if (!refocus) return;
  refocus = false;
  if (editor.value) void editor.value.focus();
  else
    surface.value
      ?.querySelector<HTMLElement>("nav [aria-pressed=true]")
      ?.focus({ preventScroll: true });
}

function finishLeaving(allow: boolean) {
  refocus = !allow;
  leaving.value = false;
  const resolve = answer;
  answer = undefined;
  resolve?.(allow);
}

async function saveAndLeave() {
  finishLeaving(await save());
}

async function edit() {
  pane.value = "editing";
  await nextTick();
  await editor.value?.focus();
}

function selectPane(next: typeof pane.value) {
  if (next === "editing") {
    void edit();
    return;
  }
  pane.value = next;
  if (next === "history") void git.refresh();
}

if (autofocusDraft) {
  watch(
    note,
    (current) => {
      if (current?.editable) void edit();
    },
    { once: true },
  );
}
</script>

<template>
  <article ref="surface" class="pe:grid pe:min-w-0 pe:gap-4" data-testid="knowledge-note">
    <KnowledgeNoteHeader
      :title="title"
      :note="note"
      :persisted-approval="persistedApproval"
      :git-status="git.status.value"
      @edit="edit"
      @history="showWorkingChanges"
    />
    <template v-if="note">
      <KnowledgeNoteTabs :pane="pane" :editable="note.editable" @select="selectPane" />
      <template v-if="pane === 'editing'">
        <KnowledgeNoteMetadata
          :fields="fields"
          :note="note"
          :persisted-approval="persistedApproval"
          :saving="saving"
          :invalid="invalidField"
          @change="(patch) => (fields = { ...fields, ...patch })"
        />
        <KnowledgeNoteEditor ref="editor" v-model="markdown" :path="note.path" :saving="saving" />
      </template>
      <KnowledgeMarkdown v-else-if="pane === 'content'" :body="note.body" :path="note.path" />
      <KnowledgeReferences
        v-else-if="pane === 'references'"
        :key="note.text"
        :source="note.path"
        :references="references"
        :editable="canEditReferences"
        @change="(values) => (fields = { ...fields, references: values })"
      />
      <ArtifactGitHistory v-else :git="git" />
      <KnowledgeDraftStatus
        :dirty="dirty"
        :saved="saved"
        :conflict="conflict"
        :save-failed="saveFailed"
        :can-write="Boolean(path)"
        :show-save="showSave"
        :saving="saving"
        :loading="loading"
        @save="save"
        @reload="reload"
      />
      <ArtifactGitActions
        :dirty="dirty"
        :editable="note.editable"
        :history="pane === 'history'"
        :saving="saving"
        :git="git"
        @compare="showWorkingChanges"
        @commit="openGitCommit"
        @save-and-commit="saveThenCommit"
      />
      <DomainKnowledgeContribution v-if="hasDomain" :note="note" />
      <KnowledgeRelatedNotes :note="note" :can-create="canDerive" />
    </template>
    <p v-else-if="loading" role="status">{{ text.loading }}</p>
    <p v-else-if="loadingError" role="alert">{{ loadingError.title }}</p>
    <ArtifactGitCommit
      :git="git"
      :restore-focus="restoreGitFocus"
      @committed="pane = 'history'"
      @review="showWorkingChanges"
    />
    <KnowledgeLeaveDialog
      v-model:open="leaving"
      :saving="saving"
      :restore-focus="restoreEditorFocus"
      @keep="finishLeaving(false)"
      @discard="finishLeaving(true)"
      @save="saveAndLeave"
    />
  </article>
</template>
