<script setup lang="ts">
import UButton from "@nuxt/ui/components/Button.vue";
import UModal from "@nuxt/ui/components/Modal.vue";
import { useForm } from "@tanstack/vue-form";
import { computed, nextTick, onScopeDispose, ref, useId } from "vue";
import { newDeliverableId, saveDeliverable } from "../../../application/backlog";
import type { DeliverableRecord } from "../../../application/backlog";
import type { KnowledgeRecord } from "../../../application/knowledge";
import type { ProjectId, ProjectMember } from "../../../application/projects";
import { deliverableStatuses } from "../../../domain/backlog";
import type { DeliverableId } from "../../../domain/backlog";
import { KnowledgeLeaveDialog } from "../../knowledge";
import { leafModalUi } from "../../projects";
import {
  ErrorNotice,
  useCommand,
  useMessages,
  useModal,
  useNavigationGuard,
  useService,
} from "../../shell";
import DeliverableEditorFields from "./DeliverableEditorFields.vue";
import { editorIssue, editorValues, fieldError } from "./editor-draft";
import type { EditorFields, EditorIssue } from "./editor-draft";

const {
  project,
  owners,
  notes,
  record = undefined,
  linkOnOpen = false,
} = defineProps<{
  readonly project: ProjectId;
  readonly owners: readonly Pick<ProjectMember, "id" | "name">[];
  readonly notes: readonly KnowledgeRecord[];
  readonly record?: DeliverableRecord | undefined;
  readonly linkOnOpen?: boolean;
}>();
const initial = record;
const emit = defineEmits<{ dismiss: [DeliverableId?] }>();
const texts = useMessages();
const text = texts.backlog.deliverables;
const id = initial?.id ?? useService(newDeliverableId);
const command = useCommand(saveDeliverable);
const open = ref(true);
const leaving = ref(false);
const panel = ref<HTMLFormElement>();
const issue = ref<EditorIssue>();
const issueId = useId();
const commandFields = new Map<string, EditorIssue>([
  ["owner", "owner_id"],
  ["template", "template"],
  ["link", "knowledge_id"],
]);
const modal = useModal(open, () => emit("dismiss", saved), close);
let saved: DeliverableId | undefined;

const form = useForm({
  defaultValues: {
    title: initial?.values.title ?? "",
    outcome: initial?.values.outcome ?? "",
    status: initial?.values.status ?? "planned",
    owner_id: initial?.values.owner_id ?? "",
    due: initial?.values.due ?? "",
    template: initial?.values.template ?? "",
    knowledge_id: initial?.values.knowledge_id ?? "",
  },
  async onSubmit({ value }) {
    if (await persist(value)) {
      saved = id;
      close();
    }
  },
});
const draft = form.useStore((state) => state.values);
const dirty = form.useStore((state) => state.isDirty);
const busy = computed(() => command.pending.value);
const canDismiss = computed(() => !busy.value && !leaving.value);

async function showIssue(field: NonNullable<typeof issue.value>) {
  issue.value = field;
  await nextTick();
  panel.value?.querySelector<HTMLElement>(`[name="${field}"]`)?.focus();
}

async function persist(value: EditorFields) {
  if (busy.value) return false;
  issue.value = undefined;
  const values = editorValues(value);
  const invalid = editorIssue(value, values);
  if (invalid) {
    await showIssue(invalid);
    return false;
  }
  const result = await command.run(project, id, values, initial);
  if (result._tag === "failure" && result.error._tag === "DeliverableError") {
    const field = commandFields.get(result.error.reason);
    if (field) await showIssue(field);
  }
  return result._tag === "success";
}

function update(field: keyof EditorFields, event: Event) {
  const target = event.currentTarget as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
  if (field !== "status") {
    form.setFieldValue(field, target.value);
    return;
  }
  const status = deliverableStatuses.find((candidate) => candidate === target.value);
  if (status) form.setFieldValue("status", status);
}

function close() {
  if (!busy.value && !leaving.value) open.value = false;
}

let answer: ((leave: boolean) => void) | undefined;
let activeControl: HTMLElement | undefined;
useNavigationGuard(() => {
  if (!open.value) return true;
  if (busy.value || answer) return false;
  if (!dirty.value) return true;
  activeControl = panel.value?.ownerDocument.activeElement as HTMLElement | undefined;
  leaving.value = true;
  return new Promise<boolean>((resolve) => {
    answer = resolve;
  });
});
onScopeDispose(() => answer?.(false));

function finish(allow: boolean) {
  leaving.value = false;
  const resolve = answer;
  answer = undefined;
  if (allow) form.reset();
  resolve?.(allow);
}

async function saveAndLeave() {
  if (await persist(draft.value)) finish(true);
}

function restoreFocus() {
  activeControl?.focus({ preventScroll: true });
}
</script>

<template>
  <UModal
    :open="open"
    :title="initial ? text.edit(initial.displayId) : text.create"
    :description="text.intro"
    :content="modal"
    :ui="{ ...leafModalUi, content: leafModalUi.content + ' pe-deliverable-modal' }"
    :dismissible="canDismiss"
    :close="false"
    @update:open="close"
  >
    <template #body>
      <form
        ref="panel"
        class="pe-deliverable-form"
        data-testid="deliverable-editor"
        novalidate
        @submit.prevent="form.handleSubmit"
      >
        <label>
          {{ text.title }}
          <input
            name="title"
            type="text"
            required
            maxlength="150"
            :data-autofocus="linkOnOpen ? undefined : ''"
            data-testid="deliverable-title"
            :value="draft.title"
            v-bind="fieldError('title', issue, issueId)"
            @input="update('title', $event)"
          />
        </label>
        <label>
          {{ text.outcome }}
          <textarea
            name="outcome"
            required
            rows="3"
            data-testid="deliverable-outcome"
            :placeholder="text.outcomeHint"
            :value="draft.outcome"
            v-bind="fieldError('outcome', issue, issueId)"
            @input="update('outcome', $event)"
          />
        </label>
        <DeliverableEditorFields
          :draft="draft"
          :owners="owners"
          :notes="notes"
          :editing="Boolean(initial)"
          :link-on-open="linkOnOpen"
          :issue="issue"
          :issue-id="issueId"
          @update="update"
        />
        <p v-if="issue" :id="issueId" role="alert" data-testid="deliverable-issue">
          {{ text.issues[issue] }}
        </p>
        <ErrorNotice v-else-if="command.message.value" :message="command.message.value" />
        <div class="pe:flex pe:flex-wrap pe:justify-end pe:gap-2">
          <UButton
            type="button"
            color="neutral"
            variant="ghost"
            data-testid="deliverable-cancel"
            :disabled="busy"
            :label="texts.backlog.cancel"
            @click="close"
          />
          <UButton
            type="submit"
            data-testid="deliverable-save"
            :loading="busy"
            :label="text.save"
          />
        </div>
      </form>
    </template>
  </UModal>
  <KnowledgeLeaveDialog
    v-model:open="leaving"
    :saving="busy"
    :restore-focus="restoreFocus"
    local-escape
    @keep="finish(false)"
    @discard="finish(true)"
    @save="saveAndLeave"
  />
</template>
