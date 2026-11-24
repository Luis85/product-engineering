<script setup lang="ts">
import UButton from "@nuxt/ui/components/Button.vue";
import UModal from "@nuxt/ui/components/Modal.vue";
import { useForm } from "@tanstack/vue-form";
import { computed, onScopeDispose, ref, useId, watch } from "vue";
import {
  PROJECT_BACKLOG,
  PROJECT_USE_CASE,
  backlogChanges,
  newNfrId,
  nfrTargets,
  saveNfr,
} from "../../../application/backlog";
import type { BacklogSnapshot, NfrRecord } from "../../../application/backlog";
import type { ProjectId, ProjectMember } from "../../../application/projects";
import { PROJECT_STORY_MAPS, storyMapNfrContribution } from "../../../application/story-maps";
import { checkNfrDraft } from "../../../domain/backlog";
import type {
  NfrCategory,
  NfrDraft,
  NfrId,
  NfrInputIssue,
  NfrTarget,
} from "../../../domain/backlog";
import { KnowledgeLeaveDialog } from "../../knowledge";
import { leafModalUi, useRememberWorkspaceOrigin } from "../../projects";
import {
  ErrorNotice,
  useAsyncStream,
  useCommand,
  useHistory,
  useMessages,
  useModal,
  useNavigate,
  useNavigationGuard,
  useQuery,
  useRouting,
} from "../../shell";
import NfrTargetFields from "./NfrTargetFields.vue";
import NfrCategoryFields from "./NfrCategoryFields.vue";
import NfrOwnerField from "./NfrOwnerField.vue";
import { focusNfrLink, nfrTargetRoute } from "./focus";

const {
  project,
  record = undefined,
  members,
} = defineProps<{
  readonly project: ProjectId;
  readonly record?: NfrRecord | undefined;
  readonly members: readonly ProjectMember[];
}>();
const initial = record;
const texts = useMessages().backlog;
const text = texts.nfr;
const panel = ref<HTMLElement>();
const open = ref(true);
const leave = ref(false);
const formId = useId();
const issues = ref<readonly NfrInputIssue[]>([]);
const navigate = useNavigate();
const { definition, history } = useRouting();
const { back } = useHistory();
const remember = useRememberWorkspaceOrigin();
const identity = useQuery(() => newNfrId);
const save = useCommand(
  (scope: ProjectId, id: NfrId, draft: NfrDraft, targets: readonly NfrTarget[], base?: NfrRecord) =>
    saveNfr(scope, id, draft, targets, base, storyMapNfrContribution),
);
const choices = useQuery((scope: ProjectId) => nfrTargets(scope, storyMapNfrContribution));
const backlog = useAsyncStream<BacklogSnapshot, never>(
  { ready: false, items: [], duplicates: [] },
  backlogChanges(project),
);
watch(backlog, () => void choices.run(project), { immediate: true });
const busy = computed(() => identity.pending.value || save.pending.value);
const error = computed(() => save.message.value ?? identity.message.value ?? choices.message.value);
const emit = defineEmits<{ dismiss: [NfrId?] }>();
let saved: NfrId | undefined;
let operation = initial?.id;
const modal = useModal(open, () => emit("dismiss", saved), close);
const focusAfterChoices = ref<string>();

function previousTarget() {
  const route = history.value.forward.at(-1);
  if (!route || !("projectId" in route) || route.projectId !== project) return;
  if (route.name === PROJECT_USE_CASE) return "item:" + route.pbiId;
  if (route.name === PROJECT_BACKLOG) return route.item && "item:" + route.item;
  if (route.name === PROJECT_STORY_MAPS) return route.mapId && "map:" + route.mapId;
}

function focusEditor(event: Event) {
  const item = previousTarget();
  const selector = item && `[data-nfr-open-target="${item}"]`;
  focusAfterChoices.value = selector;
  if (!focusNfrLink(event, selector)) modal.onOpenAutoFocus(event);
}

function restoreTarget(current: HTMLElement, selector: string) {
  const target = current.querySelector<HTMLElement>(selector);
  if (!target) return false;
  const dialog = current.closest('[role="dialog"]');
  const active = current.ownerDocument.activeElement;
  if (active === current.querySelector("[data-autofocus]") || active === dialog) {
    target.focus();
    return current.ownerDocument.activeElement === target;
  }
  return Boolean(dialog?.contains(active));
}

watch(
  [choices.value, focusAfterChoices],
  (_value, _previous, onCleanup) => {
    const selector = focusAfterChoices.value;
    const current = panel.value;
    const owner = current?.ownerDocument.defaultView;
    if (!selector || !current || !owner) return;
    let frame = owner.requestAnimationFrame(() => {
      restoreTarget(current, selector);
      frame = owner.requestAnimationFrame(() => {
        if (restoreTarget(current, selector)) focusAfterChoices.value = undefined;
      });
    });
    onCleanup(() => owner.cancelAnimationFrame(frame));
  },
  { flush: "post" },
);
const form = useForm({
  defaultValues: {
    title: initial?.title ?? "",
    requirement: initial?.requirement ?? "",
    acceptance: initial?.acceptance ?? "",
    owner_id: initial?.owner_id,
    categories: initial?.categories ?? ([] as readonly NfrCategory[]),
    targets: initial?.targets ?? ([] as readonly NfrTarget[]),
  },
  async onSubmit({ value }) {
    const result = await persist(value);
    if (result) {
      saved = result;
      close();
    }
  },
});
const draft = form.useStore((state) => state.values);
const dirty = form.useStore((state) => state.isDirty);
function fieldValue(event: Event) {
  return (event.currentTarget as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement).value;
}

async function persist(value: typeof draft.value) {
  if (busy.value) return;
  issues.value = checkNfrDraft(value);
  if (issues.value.length) {
    panel.value?.querySelector<HTMLElement>(`[name="${issues.value[0]}"]`)?.focus();
    return;
  }
  if (!operation) {
    const result = await identity.run();
    if (result._tag !== "success") return;
    operation = result.value;
  }
  const result = await save.run(project, operation, value, value.targets, initial);
  if (result._tag === "success") return operation;
}

function close() {
  if (!busy.value && !leave.value) open.value = false;
}

let answer: ((allowed: boolean) => void) | undefined;
let origin: HTMLElement | undefined;

function guard() {
  if (!open.value) return true;
  if (busy.value || answer) return false;
  if (!dirty.value) return true;
  origin = panel.value?.ownerDocument.activeElement as HTMLElement | undefined;
  leave.value = true;
  return new Promise<boolean>((resolve) => {
    answer = resolve;
  });
}
useNavigationGuard(guard);
onScopeDispose(() => answer?.(false));

function finish(allowed: boolean) {
  leave.value = false;
  const resolve = answer;
  answer = undefined;
  if (allowed) form.reset();
  resolve?.(allowed);
}

async function saveAndLeave() {
  if (await persist(draft.value)) finish(true);
}

function refocus() {
  origin?.focus({ preventScroll: true });
}

async function openTarget(target: NfrTarget, event: MouseEvent) {
  const route = nfrTargetRoute(project, target);
  if (!route) return;
  remember(event.currentTarget as HTMLElement);
  const previous = history.value.back.at(-1);
  if (target.kind === "map" && previous && definition.equals(previous, route)) return back();
  if (!(await navigate(route))) remember(undefined);
}
</script>

<template>
  <UModal
    :open="open"
    :title="initial ? text.edit : text.create"
    :description="initial?.id ?? text.intro"
    :content="{ ...modal, onOpenAutoFocus: focusEditor }"
    :close="false"
    :dismissible="!busy && !leave"
    :ui="{ ...leafModalUi, content: leafModalUi.content + ' pe-nfr-modal' }"
    @update:open="close"
  >
    <template #body>
      <form
        :id="formId"
        ref="panel"
        class="pe-nfr-form"
        data-testid="nfr-editor"
        @submit.prevent="form.handleSubmit"
      >
        <label>
          {{ text.title }}
          <input
            name="title"
            data-autofocus
            data-testid="nfr-title"
            required
            maxlength="160"
            :value="draft.title"
            @input="form.setFieldValue('title', fieldValue($event))"
          />
        </label>
        <label>
          {{ text.requirement }}
          <textarea
            name="requirement"
            data-testid="nfr-requirement"
            rows="3"
            required
            :value="draft.requirement"
            @input="form.setFieldValue('requirement', fieldValue($event))"
          />
        </label>
        <label>
          {{ text.acceptance }}
          <textarea
            name="acceptance"
            data-testid="nfr-acceptance"
            rows="3"
            required
            :value="draft.acceptance"
            @input="form.setFieldValue('acceptance', fieldValue($event))"
          />
        </label>
        <NfrOwnerField
          :model-value="draft.owner_id"
          :members="members"
          @update:model-value="form.setFieldValue('owner_id', $event)"
        />
        <NfrTargetFields
          :model-value="draft.targets"
          :options="choices.value.value ?? []"
          @update:model-value="form.setFieldValue('targets', $event)"
          @open="openTarget"
        />
        <NfrCategoryFields
          :model-value="draft.categories"
          @update:model-value="form.setFieldValue('categories', $event)"
        />
        <ul v-if="issues.length" role="alert">
          <li v-for="issue in issues" :key="issue">{{ text.issues[issue] }}</li>
        </ul>
        <ErrorNotice v-if="error" :message="error" />
      </form>
    </template>
    <template #footer>
      <UButton
        type="button"
        color="neutral"
        variant="ghost"
        data-testid="nfr-editor-cancel"
        :disabled="busy"
        :label="texts.cancel"
        @click="close"
      />
      <UButton
        type="submit"
        :form="formId"
        data-testid="nfr-editor-save"
        :loading="busy"
        :label="text.save"
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
