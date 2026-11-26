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
  BacklogCreateDraft,
  BacklogEdit,
  BacklogItem,
  BacklogPlacement,
} from "../../application/backlog";
import { openNote } from "../../application/notes";
import { projectMemberChoices } from "../../application/projects";
import type { BacklogBase, ProjectId } from "../../application/projects";
import { backlogPrototypeSource } from "../../application/prototypes";
import { PROJECT_STORY_MAPS } from "../../application/story-maps";
import type { BacklogKind, NfrId } from "../../domain/backlog";
import { ArtifactGitHistory, useArtifactGit } from "../git";
import { KnowledgeLeaveDialog } from "../knowledge";
import { leafModalUi } from "../projects";
import {
  ErrorNotice,
  useCommand,
  useHistory,
  useMessages,
  useModal,
  useNavigationGuard,
  useQuery,
  useRouting,
} from "../shell";
import BacklogEditorForm from "./BacklogEditorForm.vue";
import BacklogEditorLinks from "./BacklogEditorLinks.vue";
import { focusNfrLink } from "./nfr/focus";

const {
  project,
  base,
  items,
  kind,
  edit: initialEdit = undefined,
  level = "",
  fixedParent = "",
  restoreNfr = undefined,
  creation = undefined,
} = defineProps<{
  readonly project: ProjectId;
  readonly base: BacklogBase;
  readonly items: readonly BacklogItem[];
  readonly kind: BacklogKind;
  readonly edit?: BacklogEdit | undefined;
  readonly level?: BacklogKind | "";
  readonly fixedParent?: string;
  readonly restoreNfr?: NfrId | undefined;
  readonly creation?: {
    readonly title: string;
    readonly submit: string;
    readonly initial: Partial<BacklogCreateDraft>;
    readonly frozen: boolean;
    readonly dirty: boolean;
    readonly persist: (
      operation: BacklogCreation,
      draft: BacklogCreateDraft,
    ) => Promise<BacklogItem | undefined>;
  };
}>();
const emit = defineEmits<{
  dismiss: [reason?: "native-note"];
  saved: [BacklogItem["key"], boolean, BacklogItem?];
  adopted: [BacklogItem];
}>();
const catalogs = useMessages();
const text = catalogs.backlog;
const { history: navigationHistory } = useRouting();
const { back } = useHistory();
const storyOrigin = computed(() => {
  const previous = navigationHistory.value.back.at(-1);
  return previous?.name === PROJECT_STORY_MAPS &&
    previous.projectId === project &&
    previous.mapId !== undefined
    ? previous
    : undefined;
});
const storyReturnLabel = computed(() =>
  storyOrigin.value?.sliceId
    ? catalogs["story-maps"].handoff.back
    : catalogs["story-maps"].backToMap,
);
const frozen = computed(() => creation?.frozen ?? false);
const submitAutofocus = computed(() => (frozen.value ? "" : undefined));
const edit = shallowRef(initialEdit);
const assignedItem = computed(() => (edit.value?.item.adopted ? edit.value.item.id : undefined));
const prototypeSource = computed(
  () => edit.value && backlogPrototypeSource(project, edit.value.item),
);
const open = ref(true);
const modal = useModal(open, () => emit("dismiss"), close);
function focusEditor(event: Event) {
  const selector = restoreNfr && `[data-nfr-open-record="${restoreNfr}"]`;
  if (!focusNfrLink(event, selector)) modal.onOpenAutoFocus(event);
}
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
const submitting = ref(false);
const busy = computed(
  () =>
    submitting.value ||
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
const title = computed(() => edit.value?.item.title ?? creation?.title ?? creationTitle);
const submitted = ref(false);
let operation: BacklogCreation | undefined;

const form = useForm({
  defaultValues: {
    epic: "",
    epicTitle: "",
    featureTitle: "",
    ...(initialEdit?.draft ?? initialDraft()),
    ...creation?.initial,
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
const submitLabel = computed(() => (edit.value ? text.save : (creation?.submit ?? createLabel)));
const dirty = computed(() => isDirty.value || placement.value !== undefined || creation?.dirty);
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
  if (submitting.value) return false;
  submitting.value = true;
  try {
    if (!operation) {
      const next = await nextCreation.run(kind);
      if (next._tag !== "success") return false;
      operation = next.value;
    }
    const input = { ...value, kind };
    const item = creation
      ? await creation.persist(operation, input)
      : await create
          .run(project, operation, input)
          .then((result) => (result._tag === "success" ? result.value : undefined));
    if (!item) return false;
    emit("saved", item.key, false, item);
    return true;
  } finally {
    submitting.value = false;
  }
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
    :content="{ ...modal, onOpenAutoFocus: focusEditor }"
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
            :frozen="frozen"
            :lock-state="Boolean(creation)"
            v-model:editing="editBody"
            v-model:placement="placement"
            @field="form.setFieldValue"
            @submit="form.handleSubmit"
          >
            <template #creation-fields><slot name="creation-fields" /></template>
          </BacklogEditorForm>
          <slot name="creation-feedback" />
          <BacklogEditorLinks
            v-if="edit"
            :project="project"
            :item="assignedItem"
            :prototype-source="prototypeSource"
            :adopted="edit.item.adopted"
            :opening="native.pending.value"
            :adopting="adopt.pending.value"
            @open="openFile"
            @adopt="adoptItem"
          >
            <slot name="links" />
          </BacklogEditorLinks>
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
        v-if="storyOrigin"
        type="button"
        variant="link"
        color="neutral"
        :label="storyReturnLabel"
        :disabled="busy"
        data-testid="backlog-return-story-map"
        @click="back()"
      />
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
        :data-autofocus="submitAutofocus"
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
