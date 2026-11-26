<script setup lang="ts">
import UButton from "@nuxt/ui/components/Button.vue";
import UFormField from "@nuxt/ui/components/FormField.vue";
import UInput from "@nuxt/ui/components/Input.vue";
import UModal from "@nuxt/ui/components/Modal.vue";
import UTextarea from "@nuxt/ui/components/Textarea.vue";
import { useForm } from "@tanstack/vue-form";
import { computed, nextTick, ref } from "vue";
import { backlogChanges } from "../../application/backlog";
import type { BacklogSnapshot } from "../../application/backlog";
import { createFeatureRequest, newFeatureRequestId } from "../../application/feature-requests";
import type { FeatureRequestDraft } from "../../application/feature-requests";
import type { ProjectId } from "../../application/projects";
import {
  invalidRequestField,
  normalizeRequestScope,
  requestScopeLimit,
  requestTitleLimit,
} from "../../domain/feature-requests";
import type { FeatureRequestId } from "../../domain/feature-requests";
import { leafModalUi } from "../projects";
import {
  ErrorNotice,
  useAsyncStream,
  useCommand,
  useMessages,
  useModal,
  useNavigationGuard,
  useService,
} from "../shell";
import FeatureRequestPbiSelect from "./FeatureRequestPbiSelect.vue";

const {
  project,
  source = undefined,
  initialBacklog,
} = defineProps<{
  readonly project: ProjectId;
  readonly source?: { readonly id: string; readonly title: string } | undefined;
  readonly initialBacklog: BacklogSnapshot | undefined;
}>();
const emit = defineEmits<{ dismiss: [FeatureRequestId?]; createPbi: [] }>();
const text = useMessages()["feature-requests"];
const snapshot = useAsyncStream<BacklogSnapshot, never>(
  initialBacklog ?? { ready: false, items: [], duplicates: [] },
  backlogChanges(project),
);
const choices = computed(() =>
  snapshot.value.items.flatMap(({ kind, id, title, conflict, adopted }) =>
    kind === "UC" && id && adopted && !conflict ? [{ id, title }] : [],
  ),
);
const options = computed(() => {
  if (source && !choices.value.some(({ id }) => id === source.id)) return [source];
  return choices.value;
});
const command = useCommand(createFeatureRequest);
const busy = command.pending;
const id = useService(newFeatureRequestId);
const open = ref(true);
const panel = ref<HTMLFormElement>();
const issue = ref<"pbi" | "title" | "scope">();
const error = computed(() => (issue.value ? undefined : command.message.value));
const contextual = Boolean(source);
const locked = computed(() => busy.value || contextual);
const loading = computed(() => !snapshot.value.ready && !contextual);
const empty = computed(() => !contextual && !choices.value.length);
const canSave = computed(() => snapshot.value.ready && !empty.value);
const editableFields = ["title", "scope"] as const;
const fields = {
  title: {
    component: UInput,
    label: text.titleField,
    max: requestTitleLimit,
    placeholder: text.inheritTitle,
  },
  scope: {
    component: UTextarea,
    label: text.scope,
    max: requestScopeLimit,
    placeholder: undefined,
  },
};
let saved: FeatureRequestId | undefined;
let creatingPbi = false;
const modal = useModal(
  open,
  () => {
    if (creatingPbi) emit("createPbi");
    else emit("dismiss", saved);
  },
  close,
);
useNavigationGuard(() => !busy.value);

async function invalid(field: NonNullable<typeof issue.value>) {
  issue.value = field;
  await nextTick();
  panel.value?.querySelector<HTMLElement>(`[name="${field === "pbi" ? "pbiId" : field}"]`)?.focus();
}

function validation({ pbiId, title, scope }: FeatureRequestDraft) {
  const pbi = choices.value.find((item) => item.id === pbiId);
  if (!pbi) return "pbi";
  if (invalidRequestField("title", title.trim() || pbi.title)) return "title";
  if (invalidRequestField("scope", normalizeRequestScope(scope))) return "scope";
  return undefined;
}

function fieldIssue(reason: string) {
  if (reason === "pbi" || reason === "title" || reason === "scope") return reason;
}

const form = useForm({
  defaultValues: { pbiId: source?.id ?? "", title: source?.title ?? "", scope: text.defaultScope },
  async onSubmit({ value }) {
    if (busy.value) return;
    issue.value = undefined;
    const invalidField = validation(value);
    if (invalidField) return invalid(invalidField);
    const result = await command.run(project, id, value, contextual);
    if (result._tag === "success") {
      saved = result.value;
      close();
    } else if (result._tag === "failure" && result.error._tag === "FeatureRequestError") {
      const problem = fieldIssue(result.error.reason);
      if (problem) await invalid(problem);
    }
  },
});

function close() {
  if (!busy.value) open.value = false;
}

function createPbi() {
  creatingPbi = true;
  close();
}
</script>

<template>
  <UModal
    :open="open"
    :title="text.create"
    :content="modal"
    :ui="leafModalUi"
    :dismissible="!busy"
    :close="false"
    @update:open="close"
  >
    <template #body>
      <form
        ref="panel"
        class="pe:grid pe:min-w-0 pe:gap-3"
        data-testid="request-form"
        novalidate
        @submit.prevent="form.handleSubmit"
      >
        <p v-if="loading" role="status">{{ text.loading }}</p>
        <template v-else-if="empty">
          <p role="status">{{ text.needsPbi }}</p>
          <UButton
            type="button"
            class="pe:justify-self-start"
            :label="text.createPbi"
            data-autofocus
            data-testid="request-create-pbi"
            @click="createPbi"
          />
        </template>
        <template v-else>
          <form.Field v-slot="{ field }" name="pbiId">
            <FeatureRequestPbiSelect
              :options="options"
              :value="field.state.value"
              :contextual="contextual"
              :locked="locked"
              :invalid="issue === 'pbi'"
              @change="field.handleChange"
            />
          </form.Field>
          <form.Field v-for="name in editableFields" :key="name" v-slot="{ field }" :name="name">
            <UFormField
              :label="fields[name].label"
              :error="issue === name ? text.errors[name] : false"
            >
              <component
                :is="fields[name].component"
                :name="name"
                class="pe:w-full"
                :model-value="field.state.value"
                :placeholder="fields[name].placeholder"
                :maxlength="fields[name].max"
                :data-autofocus="(name === 'title' && contextual) || undefined"
                :aria-required="name === 'scope'"
                :aria-invalid="issue === name"
                :readonly="busy"
                @update:model-value="(value: string) => field.handleChange(value)"
              />
            </UFormField>
          </form.Field>
        </template>
        <ErrorNotice v-if="error" :message="error" />
        <div class="pe:flex pe:flex-wrap pe:justify-end pe:gap-2">
          <UButton
            type="button"
            color="neutral"
            variant="ghost"
            :label="text.cancel"
            :disabled="busy"
            @click="close"
          />
          <UButton
            v-if="canSave"
            type="submit"
            :loading="busy"
            :label="text.save"
            data-testid="request-save"
          />
        </div>
      </form>
    </template>
  </UModal>
</template>
