<script setup lang="ts">
import UButton from "@nuxt/ui/components/Button.vue";
import UFormField from "@nuxt/ui/components/FormField.vue";
import UInput from "@nuxt/ui/components/Input.vue";
import UModal from "@nuxt/ui/components/Modal.vue";
import { useForm } from "@tanstack/vue-form";
import { computed, nextTick, ref, watch } from "vue";
import {
  createKnowledge,
  isKnowledgeKind,
  knowledgeChanges,
  knowledgeKinds,
  knowledgeSnapshot,
  newKnowledgeId,
  projectKnowledge,
} from "../../application/knowledge";
import type {
  CreateKnowledgeRequest,
  KnowledgeDraft,
  KnowledgeKind,
  KnowledgeOrigin,
} from "../../application/knowledge";
import type { Note } from "../../application/notes";
import { openNote } from "../../application/notes";
import { projectChanges, projectMemberChoices, projectSnapshot } from "../../application/projects";
import type { ProjectId } from "../../application/projects";
import type { KnowledgeId } from "../../domain/knowledge";
import { leafModalUi } from "../projects";
import {
  ErrorNotice,
  useCommand,
  useMessages,
  useModal,
  useNavigationGuard,
  useQuery,
  useRoute,
  useService,
  useStream,
} from "../shell";
import KnowledgeFoundations from "./KnowledgeFoundations.vue";
import KnowledgeSelect from "./KnowledgeSelect.vue";

const {
  projectId,
  initialTemplate,
  origin = undefined,
  initialVision = undefined,
  onCreated = undefined,
} = defineProps<{
  readonly projectId: ProjectId;
  readonly initialTemplate: KnowledgeKind;
  readonly origin?: KnowledgeOrigin;
  readonly initialVision?: KnowledgeId | undefined;
  readonly onCreated?: (note: Note) => void | Promise<void>;
}>();
const emit = defineEmits<{ dismiss: [] }>();
const catalog = useMessages();
const text = catalog.knowledge;
const labels = catalog.projects.templates.labels;
const projects = useStream(projectSnapshot, projectChanges);
const project = computed(() => projects.value.projects.find(({ id }) => id === projectId));
const members = useQuery(projectMemberChoices);
watch(project, () => void members.run(projectId), { immediate: true });
const templateOptions = knowledgeKinds.map((value) => ({ value, label: labels[value] }));
const actorOptions = Object.entries(text.actorTypes).map(([value, label]) => ({ value, label }));
const ownerOptions = computed(() =>
  (members.value.value ?? []).map(({ id, name }) => ({ value: id, label: name })),
);
const open = ref(true);
const modal = useModal(open, () => emit("dismiss"));
const controls = ref<HTMLFormElement>();
const id = useService(newKnowledgeId);
const command = useCommand(createKnowledge);
const opener = useCommand(openNote);
const pending = computed(() => command.pending.value || opener.pending.value);
const route = useRoute();
useNavigationGuard(() => !pending.value);
const fieldErrors = ["title", "actor_type", "owner_id", "vision_id", "job_ids"] as const;
const invalid = ref<(typeof fieldErrors)[number]>();
const commandError = computed(() => (invalid.value ? undefined : command.message.value));
const templateLocked = computed(() => pending.value || Boolean(origin));
const knowledge = useStream(knowledgeSnapshot, knowledgeChanges);
const entries = computed(() => projectKnowledge(projectId, knowledge.value.records));
const visions = computed(() => entries.value.filter(({ kind }) => kind === "vision"));
const jobs = computed(() => entries.value.filter(({ kind }) => kind === "jtbd"));
const source = computed(
  () =>
    origin &&
    (entries.value.find((entry) => entry.id === origin.recordId)?.title ?? origin.recordId),
);

function titleFor(kind: KnowledgeKind) {
  return project.value ? text.defaultTitle(labels[kind], project.value.name) : labels[kind];
}

const initial: KnowledgeDraft = {
  kind: initialTemplate,
  title: titleFor(initialTemplate),
  actor_type: "",
  owner_id: "",
  vision_id: origin?.kind === "vision" ? origin.recordId : (initialVision ?? ""),
  job_ids: origin?.kind === "job" ? [origin.recordId] : [],
};

async function openCreated(note: Note) {
  if (onCreated) {
    open.value = false;
    await onCreated(note);
  } else if ((await opener.run(note.path))._tag === "success") {
    open.value = false;
  }
}

async function focusError(error: NonNullable<typeof command.error.value>) {
  const reason =
    error._tag === "NotePathTakenError"
      ? "title"
      : error._tag === "KnowledgeCreateError"
        ? error.reason
        : undefined;
  const field = fieldErrors.find((name) => name === reason);
  if (!field) return;
  invalid.value = field;
  await nextTick();
  controls.value?.querySelector<HTMLElement>(`[name="${field}"]`)?.focus();
}

const request: CreateKnowledgeRequest = { projectId, id, ...(origin && { origin }) };
const form = useForm({
  defaultValues: initial,
  async onSubmit({ value }) {
    invalid.value = undefined;
    if (!("projectId" in route.value) || route.value.projectId !== projectId) {
      dismiss();
      return;
    }
    const outcome = await command.run(request, value);
    if (outcome._tag === "success") await openCreated(outcome.value);
    if (outcome._tag === "failure") await focusError(outcome.error);
  },
});
const selectedKind = form.useStore((state) => state.values.kind);
const selectedVision = form.useStore((state) => state.values.vision_id);
const selectedJobs = form.useStore((state) => state.values.job_ids);

function chooseKind(input: string) {
  if (!isKnowledgeKind(input)) return;
  if (form.getFieldValue("title") === titleFor(selectedKind.value)) {
    form.setFieldValue("title", titleFor(input));
  }
  form.setFieldValue("actor_type", "");
  form.setFieldValue("vision_id", "");
  form.setFieldValue("job_ids", []);
  form.setFieldValue("kind", input);
}

function fieldError(name: (typeof fieldErrors)[number]) {
  return invalid.value === name ? command.message.value?.title : undefined;
}

function toggleJob(jobId: string, checked: boolean) {
  form.setFieldValue("job_ids", (selection) =>
    checked ? [...selection, jobId] : selection.filter((job) => job !== jobId),
  );
}

function submit() {
  if (!pending.value) return form.handleSubmit();
}

function dismiss() {
  if (!pending.value) open.value = false;
}
</script>

<template>
  <UModal
    :open="open"
    :title="text.create"
    :content="modal"
    :ui="leafModalUi"
    :dismissible="!pending"
    @update:open="dismiss"
  >
    <template #body>
      <form
        ref="controls"
        class="pe:grid pe:gap-4"
        novalidate
        @submit.prevent="submit"
        @keydown.esc.stop.prevent="dismiss"
      >
        <p v-if="source" class="pe:wrap-anywhere pe:text-sm pe:text-muted">
          {{ text.origin }} · {{ source }}
        </p>
        <form.Field v-slot="{ field }" name="title">
          <UFormField :label="text.noteTitle" :error="fieldError('title') ?? false">
            <UInput
              name="title"
              :model-value="field.state.value"
              class="pe:w-full"
              :readonly="pending"
              aria-required="true"
              data-autofocus
              @update:model-value="(value) => field.handleChange(String(value))"
            />
          </UFormField>
        </form.Field>
        <form.Field v-slot="{ field }" name="kind">
          <KnowledgeSelect
            name="kind"
            :label="text.template"
            :model-value="field.state.value"
            :options="templateOptions"
            :disabled="templateLocked"
            @update:model-value="chooseKind"
          />
        </form.Field>
        <form.Field v-if="selectedKind === 'actor'" v-slot="{ field }" name="actor_type">
          <KnowledgeSelect
            name="actor_type"
            :label="text.actorFilter"
            :empty="text.chooseActor"
            :error="fieldError('actor_type')"
            :model-value="field.state.value"
            :options="actorOptions"
            :disabled="pending"
            required
            @update:model-value="field.handleChange"
          />
        </form.Field>
        <form.Field v-slot="{ field }" name="owner_id">
          <KnowledgeSelect
            name="owner_id"
            :label="text.owner"
            :empty="text.unassigned"
            :error="fieldError('owner_id')"
            :model-value="field.state.value"
            :options="ownerOptions"
            :disabled="pending"
            @update:model-value="field.handleChange"
          />
        </form.Field>
        <KnowledgeFoundations
          v-if="selectedKind === 'prd'"
          :vision="selectedVision"
          :selected-jobs="selectedJobs"
          :visions="visions"
          :jobs-options="jobs"
          :origin="origin"
          :pending="pending"
          :invalid="invalid"
          @update:vision="form.setFieldValue('vision_id', $event)"
          @toggle-job="toggleJob"
        />
        <ErrorNotice v-if="commandError" :message="commandError" />
        <ErrorNotice v-if="opener.message.value" :message="opener.message.value" />
        <div class="pe:flex pe:flex-wrap pe:justify-end pe:gap-2">
          <UButton
            type="button"
            color="neutral"
            variant="ghost"
            data-testid="knowledge-create-cancel"
            :disabled="pending"
            @click="dismiss"
          >
            {{ text.cancel }}
          </UButton>
          <UButton type="submit" :loading="pending">{{
            onCreated ? text.openDraft : text.submit
          }}</UButton>
        </div>
      </form>
    </template>
  </UModal>
</template>
