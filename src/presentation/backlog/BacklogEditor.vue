<script setup lang="ts">
import UButton from "@nuxt/ui/components/Button.vue";
import UModal from "@nuxt/ui/components/Modal.vue";
import { useForm } from "@tanstack/vue-form";
import { computed, onScopeDispose, ref, shallowRef, useId, watch } from "vue";
import {
  adoptBacklogItem,
  backlogGitSource,
  backlogTitleIssue,
  companionKinds,
  createBacklogItem,
  initialBacklogDraft,
  newBacklogCreation,
  readBacklogItem,
  saveBacklogItem,
} from "../../application/backlog";
import type {
  BacklogCreation,
  BacklogEdit,
  BacklogItem,
  BacklogPlacement,
} from "../../application/backlog";
import { openNote } from "../../application/notes";
import { projectMemberChoices } from "../../application/projects";
import type { BacklogBase, ProjectId } from "../../application/projects";
import type { BacklogKind } from "../../domain/backlog";
import { ArtifactGitHistory, useArtifactGit } from "../git";
import { KnowledgeLeaveDialog } from "../knowledge";
import { leafModalUi } from "../projects";
import {
  ErrorNotice,
  useCommand,
  useMessages,
  useModal,
  useNavigationGuard,
  useQuery,
} from "../shell";
import BacklogEditorForm from "./BacklogEditorForm.vue";

const {
  project,
  base,
  items,
  kind,
  edit: initialEdit = undefined,
  level = "",
  fixedParent = "",
} = defineProps<{
  readonly project: ProjectId;
  readonly base: BacklogBase;
  readonly items: readonly BacklogItem[];
  readonly kind: BacklogKind;
  readonly edit?: BacklogEdit | undefined;
  readonly level?: BacklogKind | "";
  readonly fixedParent?: string;
}>();
const emit = defineEmits<{
  dismiss: [reason?: "native-note"];
  saved: [BacklogItem["key"], boolean, BacklogItem?];
  adopted: [BacklogItem];
}>();
const text = useMessages().backlog;
const edit = shallowRef(initialEdit);
const open = ref(true);
const modal = useModal(open, () => emit("dismiss"), close);
const id = useId();
const panel = ref<HTMLElement>();
const leave = ref(false);
const history = ref(false);
const editBody = ref(!initialEdit);
const placement = ref<BacklogPlacement>();
const members = useQuery(projectMemberChoices);
const nextCreation = useQuery(newBacklogCreation);
const create = useCommand(createBacklogItem);
const save = useCommand(saveBacklogItem);
const reload = useQuery(readBacklogItem);
const adopt = useCommand(adoptBacklogItem);
const native = useCommand(openNote);
const git = useArtifactGit(() => backlogGitSource(project, edit.value?.item.key ?? ""));
const error = computed(
  () => save.message.value ?? create.message.value ?? adopt.message.value ?? native.message.value,
);
const busy = computed(
  () =>
    create.pending.value ||
    save.pending.value ||
    adopt.pending.value ||
    nextCreation.pending.value ||
    native.pending.value,
);
const companion = companionKinds.find((candidate) => candidate === kind);
const createLabel =
  fixedParent && companion ? text.companions.labels[companion] : text.createType(text.types[kind]);
const creationTitle = fixedParent
  ? text.companions.creationTitle(createLabel, fixedParent)
  : createLabel;
const title = computed(() => edit.value?.item.title ?? creationTitle);
const submitted = ref(false);
let operation: BacklogCreation | undefined;

const form = useForm({
  defaultValues: {
    ...(initialEdit?.draft ?? initialDraft()),
    epic: "",
    epicTitle: "",
    featureTitle: "",
  },
  async onSubmit({ value }) {
    if (await persist(value)) close();
  },
});

function initialDraft() {
  const draft = initialBacklogDraft(kind, base);
  if (!fixedParent) return kind === "UC" ? { ...draft, body: text.pbiTemplate } : draft;
  return {
    ...draft,
    parent: fixedParent,
    priority: base.priorities.includes("P2") ? "P2" : "",
  };
}
const draft = form.useStore((state) => state.values);
const isDirty = form.useStore((state) => state.isDirty);
const memberChoices = computed(() => members.value.value ?? []);
const invalidTitle = computed(
  () => submitted.value && Boolean(backlogTitleIssue(draft.value.title)),
);
const editPath = computed(() => edit.value?.item.path ?? base.folder);
const dialogDescription = computed(() => edit.value?.item.id ?? text.types[kind]);
const cancelLabel = computed(() => (history.value ? text.close : text.cancel));
const submitLabel = computed(() => (edit.value ? text.save : createLabel));
const dirty = computed(() => isDirty.value || placement.value !== undefined);
watch(
  () => draft.value.parent,
  () => {
    placement.value = undefined;
  },
);
void members.run(project);

async function persist(value: typeof draft.value, retain = false) {
  submitted.value = true;
  if (backlogTitleIssue(value.title)) return false;
  const current = edit.value;
  return current ? persistExisting(current, value, retain) : persistNew(value);
}

async function persistExisting(current: BacklogEdit, value: typeof draft.value, retain: boolean) {
  const result = await save.run(project, current, value, placement.value);
  if (result._tag !== "success") return false;
  emit("saved", current.item.key, !!placement.value || value.parent !== current.draft.parent);
  if (retain) {
    const refreshed = await reload.run(project, current.item.key);
    if (refreshed._tag === "success") {
      edit.value = refreshed.value;
      form.reset({ ...value, ...refreshed.value.draft });
    }
  }
  return true;
}

async function persistNew(value: typeof draft.value) {
  if (!operation) {
    const next = await nextCreation.run(kind);
    if (next._tag !== "success") return false;
    operation = next.value;
  }
  const result = await create.run(project, operation, { ...value, kind });
  if (result._tag !== "success") return false;
  emit("saved", result.value.key, false, result.value);
  return true;
}

function close() {
  if (!busy.value) open.value = false;
}

let answer: ((allowed: boolean) => void) | undefined;
let origin: HTMLElement | undefined;
function guard(trigger?: HTMLElement) {
  if (busy.value || answer) return false;
  if (!dirty.value) return true;
  origin = trigger ?? (panel.value?.ownerDocument.activeElement as HTMLElement | undefined);
  leave.value = true;
  return new Promise<boolean>((resolve) => {
    answer = resolve;
  });
}
useNavigationGuard(() => (open.value ? guard() : true));
onScopeDispose(() => answer?.(false));

function finish(allowed: boolean) {
  leave.value = false;
  const resolve = answer;
  answer = undefined;
  if (allowed) {
    form.reset();
    placement.value = undefined;
  }
  resolve?.(allowed);
}

async function saveAndLeave() {
  if (await persist(draft.value, true)) finish(true);
}

function refocus() {
  origin?.focus({ preventScroll: true });
}

async function showHistory(event: MouseEvent) {
  if (!(await guard(event.currentTarget as HTMLElement))) return;
  history.value = true;
  void git.refresh();
}

async function openFile(event: MouseEvent) {
  if (!edit.value || !(await guard(event.currentTarget as HTMLElement))) return;
  const result = await native.run(edit.value.item.path);
  if (result._tag === "success") emit("dismiss", "native-note");
}

async function adoptItem(event: MouseEvent) {
  if (!edit.value || !(await guard(event.currentTarget as HTMLElement))) return;
  const result = await adopt.run(project, edit.value.item.key);
  if (result._tag === "success") emit("adopted", result.value);
}
</script>

<template>
  <UModal
    :open="open"
    :title="title"
    :description="dialogDescription"
    :content="modal"
    :ui="{
      ...leafModalUi,
      content: leafModalUi.content + ' pe:max-w-[54rem]',
      body: 'pe:min-w-0 pe:p-4',
      footer: 'pe:flex-wrap',
    }"
    :dismissible="!busy"
    :close="false"
    @update:open="close"
  >
    <template #body>
      <div ref="panel" class="pe:grid pe:min-w-0 pe:gap-4">
        <ArtifactGitHistory v-if="history" :git="git" />
        <template v-else>
          <BacklogEditorForm
            :id="id"
            :kind="kind"
            :items="items"
            :base="base"
            :members="memberChoices"
            :creating="!edit"
            :busy="busy"
            :draft="draft"
            :invalid-title="invalidTitle"
            :item="edit?.item"
            :level="level"
            :path="editPath"
            :fixed-parent="Boolean(fixedParent)"
            v-model:editing="editBody"
            v-model:placement="placement"
            @field="form.setFieldValue"
            @submit="form.handleSubmit"
          />
          <section v-if="edit" :aria-label="text.related" class="pe-backlog-editor-section">
            <h3 class="pe:text-sm pe:font-semibold">{{ text.related }}</h3>
            <slot name="links" />
            <div class="pe-backlog-actions">
              <UButton
                type="button"
                variant="soft"
                color="neutral"
                data-testid="backlog-open-note"
                :label="text.nativeNote"
                :loading="native.pending.value"
                @click="openFile"
              />
              <UButton
                v-if="!edit.item.adopted"
                type="button"
                variant="soft"
                color="neutral"
                data-testid="backlog-adopt"
                :label="text.adopt"
                :loading="adopt.pending.value"
                @click="adoptItem"
              />
            </div>
          </section>
          <UButton
            v-if="edit"
            type="button"
            variant="link"
            color="neutral"
            data-testid="backlog-open-history"
            :label="text.history"
            class="pe:justify-self-start"
            @click="showHistory"
          />
        </template>
        <ErrorNotice v-if="error" :message="error" />
      </div>
    </template>
    <template #footer>
      <UButton
        v-if="history"
        type="button"
        variant="soft"
        color="neutral"
        :label="text.edit"
        @click="history = false"
      />
      <UButton
        type="button"
        variant="ghost"
        color="neutral"
        data-testid="backlog-cancel"
        :disabled="busy"
        :label="cancelLabel"
        @click="close"
      />
      <UButton
        v-if="!history"
        type="submit"
        :form="id"
        data-testid="backlog-save"
        :loading="busy"
        :label="submitLabel"
      />
    </template>
  </UModal>
  <KnowledgeLeaveDialog
    v-model:open="leave"
    :saving="busy"
    :restore-focus="refocus"
    local-escape
    @keep="finish(false)"
    @discard="finish(true)"
    @save="saveAndLeave"
  />
</template>
