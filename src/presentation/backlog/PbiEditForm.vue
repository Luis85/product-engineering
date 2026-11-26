<script setup lang="ts">
import UButton from "@nuxt/ui/components/Button.vue";
import { useForm } from "@tanstack/vue-form";
import { computed, onScopeDispose, ref, shallowRef, watch } from "vue";
import { pbiSourceDraft, readPbiDetail, savePbiDraft } from "../../application/backlog";
import type { PbiDetail, PbiDraft } from "../../application/backlog";
import { knowledgeChanges, knowledgeSnapshot, projectKnowledge } from "../../application/knowledge";
import type { UserMessage } from "../../application/shell";
import { KnowledgeLeaveDialog, KnowledgeNoteEditor } from "../knowledge";
import {
  ErrorNotice,
  useCommand,
  useMessages,
  useNavigationGuard,
  useQuery,
  useStream,
} from "../shell";
import PbiSourceFields from "./PbiSourceFields.vue";

const { detail } = defineProps<{ readonly detail: PbiDetail }>();
const emit = defineEmits<{ cancel: []; saved: []; reloaded: [PbiDetail] }>();
const text = useMessages().backlog;
const catalog = useStream(knowledgeSnapshot, knowledgeChanges);
const options = computed(() => projectKnowledge(detail.projectId, catalog.value.records));
const current = shallowRef(detail.edit);
const panel = ref<HTMLElement>();
const editor = ref<InstanceType<typeof KnowledgeNoteEditor>>();
const leave = ref(false);
const save = useCommand(savePbiDraft);
const read = useQuery(readPbiDetail);
const busy = computed(() => save.pending.value || read.pending.value);
const failure = shallowRef<{ message: UserMessage; canReload: boolean }>();
let answer: ((allowed: boolean) => void) | undefined;
let origin: HTMLElement | undefined;

function defaults(): PbiDraft {
  return {
    title: current.value.draft.title,
    body: current.value.draft.body,
    integration: current.value.item.fields.pbi_integration_change === true,
    ...pbiSourceDraft(current.value.item.fields),
  };
}

const form = useForm({
  defaultValues: defaults(),
  async onSubmit({ value }) {
    await persist(value);
  },
});
const draft = form.useStore((state) => state.values);
const dirty = form.useStore((state) => state.isDirty);
function reset(latest = detail.edit) {
  current.value = latest;
  failure.value = undefined;
  form.reset(defaults());
}

watch(
  () => detail.edit,
  () => {
    if (!dirty.value && !busy.value) reset();
  },
);

async function persist(value: PbiDraft) {
  if (busy.value) return false;
  failure.value = undefined;
  const result = await save.run(detail.projectId, current.value, value);
  if (result._tag === "failure") {
    const { error, message } = result;
    failure.value = {
      message,
      canReload: error._tag === "BacklogError" && error.reason === "conflict",
    };
  }
  if (result._tag !== "success") return false;
  const saved = result.value;
  current.value = {
    ...current.value,
    item: { ...current.value.item, fields: saved.frontmatter, path: saved.path },
    draft: { ...current.value.draft, body: saved.body, title: value.title.trim() },
  };
  form.reset(defaults());
  emit("saved");
  return true;
}

async function reload() {
  if (busy.value) return;
  const result = await read.run(detail.projectId, detail.pbiId);
  if (result._tag === "failure") failure.value = { message: result.message, canReload: true };
  if (result._tag !== "success") return;
  reset(result.value.edit);
  emit("reloaded", result.value);
  await editor.value?.focus();
}

function guard(trigger?: HTMLElement) {
  if (busy.value || answer) return false;
  if (!dirty.value) return true;
  origin = trigger ?? (panel.value?.ownerDocument.activeElement as HTMLElement | undefined);
  leave.value = true;
  return new Promise<boolean>((resolve) => {
    answer = resolve;
  });
}

function finish(allowed: boolean) {
  leave.value = false;
  const resolve = answer;
  answer = undefined;
  if (allowed) reset();
  resolve?.(allowed);
}

async function saveAndLeave() {
  if (await persist(draft.value)) {
    leave.value = false;
    const resolve = answer;
    answer = undefined;
    resolve?.(true);
  }
}

useNavigationGuard(() => guard());
onScopeDispose(() => answer?.(false));
defineExpose({ guard });
</script>

<template>
  <form
    ref="panel"
    class="pe:grid pe:min-w-0 pe:gap-4"
    data-testid="pbi-edit-form"
    novalidate
    @submit.prevent="form.handleSubmit"
  >
    <label class="pe:grid pe:gap-1 pe:text-sm">
      {{ text.titleField }}
      <input
        type="text"
        name="pbi-title"
        :value="draft.title"
        :readonly="busy"
        maxlength="160"
        required
        @input="form.setFieldValue('title', ($event.currentTarget as HTMLInputElement).value)"
      />
    </label>
    <section class="pe-backlog-editor-section" :aria-label="text.notes">
      <h2 class="pe:font-semibold">{{ text.notes }}</h2>
      <KnowledgeNoteEditor
        ref="editor"
        :model-value="draft.body"
        :path="current.item.path"
        :accessible-label="text.notes"
        :saving="busy"
        @update:model-value="form.setFieldValue('body', $event)"
      />
    </section>
    <PbiSourceFields :draft="draft" :options="options" :saving="busy" @field="form.setFieldValue" />
    <ErrorNotice v-if="failure" :message="failure.message" />
    <div class="pe-backlog-actions">
      <UButton
        type="submit"
        :label="text.pbiSave"
        data-testid="pbi-save"
        :loading="save.pending.value"
        :disabled="read.pending.value"
      />
      <UButton
        type="button"
        variant="ghost"
        color="neutral"
        :label="text.cancel"
        data-testid="pbi-cancel-edit"
        :disabled="busy"
        @click="emit('cancel')"
      />
      <UButton
        v-if="failure?.canReload"
        type="button"
        variant="soft"
        :label="text.pbiReload"
        :loading="read.pending.value"
        :disabled="save.pending.value"
        @click="reload"
      />
    </div>
  </form>
  <KnowledgeLeaveDialog
    v-model:open="leave"
    :saving="busy"
    :restore-focus="() => origin?.focus({ preventScroll: true })"
    local-escape
    @keep="finish(false)"
    @discard="finish(true)"
    @save="saveAndLeave"
  />
</template>
