<script setup lang="ts">
import { computed, nextTick, onScopeDispose, ref, watch } from "vue";
import type {
  ProjectId,
  ProjectRecordRoute,
  ProjectSearchRecord,
} from "../../application/projects";
import type { Route } from "../../application/routes";
import { useRestoreWorkspacePosition } from "../projects";
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
const historyStatus = computed(() => (saved.value ? text.note.savedStatus : text.note.unverified));
let answer: ((leave: boolean) => void) | undefined;
let refocus = false;

useNavigationGuard(() => {
  if (saving.value) return false;
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
  if (next === "editing") void edit();
  else pane.value = next;
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
    <KnowledgeNoteHeader :title="title" :note="note" @edit="edit" @history="pane = 'history'" />
    <template v-if="note">
      <KnowledgeNoteTabs :pane="pane" :editable="note.editable" @select="selectPane" />
      <template v-if="pane === 'editing'">
        <KnowledgeNoteMetadata
          :fields="fields"
          :note="note"
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
      <p v-else class="pe:text-sm pe:text-muted">{{ historyStatus }}</p>
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
      <KnowledgeRelatedNotes :note="note" :can-create="canDerive" />
    </template>
    <p v-else-if="loading" role="status">{{ text.loading }}</p>
    <p v-else-if="loadingError" role="alert">{{ loadingError.title }}</p>
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
