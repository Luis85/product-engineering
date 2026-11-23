import { computed, ref, shallowRef, watch } from "vue";
import {
  knowledgeBodyChanges,
  knowledgeBodySnapshot,
  readKnowledgeNote,
  saveKnowledgeNote,
} from "../../application/knowledge";
import type { KnowledgeEditFields, KnowledgeNote } from "../../application/knowledge";
import type { ProjectRecordRoute } from "../../application/projects";
import { sameFrontmatterValue } from "../../domain/notes";
import { useCommand, useQuery, useStream } from "../shell";

function editorText(body: string) {
  return body.replace(/\r\n|\r/g, "\n");
}

function fieldsConflict(base: KnowledgeNote, current: KnowledgeNote, fields: KnowledgeEditFields) {
  return Object.entries(fields).some(([key, value]) => {
    const field = key as keyof KnowledgeEditFields;
    const fresh = current.values[field];
    return !sameFrontmatterValue(fresh, base.values[field]) && !sameFrontmatterValue(fresh, value);
  });
}

export function useKnowledgeDraft(
  record: ProjectRecordRoute,
  currentPath: () => string | undefined,
) {
  const query = useQuery(readKnowledgeNote);
  const writer = useCommand(saveKnowledgeNote);
  const modified = useStream(knowledgeBodySnapshot, knowledgeBodyChanges);
  const note = shallowRef<KnowledgeNote>();
  const markdown = ref("");
  const fields = shallowRef<KnowledgeEditFields>({});
  const conflict = ref(false);
  const saveFailed = ref(false);
  const invalidField = ref<keyof KnowledgeEditFields>();
  const saved = ref(false);
  const bodyDirty = computed(
    () => note.value !== undefined && markdown.value !== editorText(note.value.body),
  );
  const changedFields = computed(
    () =>
      Object.fromEntries(
        Object.entries(fields.value).filter(
          ([key, value]) =>
            !sameFrontmatterValue(value, note.value?.values[key as keyof KnowledgeEditFields]),
        ),
      ) as KnowledgeEditFields,
  );
  const dirty = computed(() => bodyDirty.value || Object.keys(changedFields.value).length > 0);

  function adopt(current: KnowledgeNote) {
    note.value = current;
    markdown.value = editorText(current.body);
    fields.value = {};
    conflict.value = false;
  }

  async function refresh(discard = false) {
    const path = currentPath();
    if (!path) return;
    const outcome = await query.run(record.projectId, record.reference.recordId, path);
    if (outcome._tag !== "success") {
      if (outcome._tag === "failure" && dirty.value) conflict.value = true;
      return;
    }
    const current = outcome.value;
    const base = note.value;
    if (discard || !dirty.value || !base) return adopt(current);
    checkOutsideChanges(base, current);
  }

  function checkOutsideChanges(base: KnowledgeNote, current: KnowledgeNote) {
    // A rename changes the resolution base without changing the record version.
    note.value = { ...base, path: current.path };
    const competingBody =
      bodyDirty.value && current.body !== base.body && editorText(current.body) !== markdown.value;
    conflict.value = competingBody || fieldsConflict(base, current, changedFields.value);
  }

  watch(
    currentPath,
    (path, previous) => {
      if (path) void refresh();
      else if (previous) {
        if (dirty.value) conflict.value = true;
        else note.value = undefined;
      }
    },
    { immediate: true },
  );
  watch(modified, (event) => {
    if (event?.path === currentPath()) void refresh();
  });

  async function save() {
    const base = note.value;
    if (!base || writer.pending.value || !currentPath()) return false;
    if (!dirty.value) return true;
    saveFailed.value = false;
    invalidField.value = undefined;
    const outcome = await writer.run(base, markdown.value, changedFields.value);
    if (outcome._tag === "success") {
      adopt(outcome.value);
      saved.value = true;
      return true;
    }
    showSaveFailure(outcome._tag === "failure" ? outcome.error : undefined);
    return false;
  }

  function showSaveFailure(error: typeof writer.error.value) {
    if (error?._tag === "NoteEditConflictError") conflict.value = true;
    if (error?._tag === "KnowledgeEditError") invalidField.value = error.reason;
    saveFailed.value = !conflict.value && !invalidField.value;
  }

  async function reload() {
    if (writer.pending.value) return;
    saveFailed.value = false;
    invalidField.value = undefined;
    await refresh(true);
  }

  return {
    note,
    markdown,
    fields,
    dirty,
    saved,
    conflict,
    saveFailed,
    invalidField,
    loading: query.pending,
    loadingError: query.message,
    saving: writer.pending,
    save,
    reload,
  };
}
