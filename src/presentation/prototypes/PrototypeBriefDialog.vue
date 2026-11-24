<script setup lang="ts">
import UButton from "@nuxt/ui/components/Button.vue";
import UFormField from "@nuxt/ui/components/FormField.vue";
import UInput from "@nuxt/ui/components/Input.vue";
import UModal from "@nuxt/ui/components/Modal.vue";
import UTextarea from "@nuxt/ui/components/Textarea.vue";
import { useForm } from "@tanstack/vue-form";
import { computed, nextTick, ref } from "vue";
import type { ProjectId } from "../../application/projects";
import {
  newPrototypeId,
  prototypeSourcesChanges,
  savePrototype,
} from "../../application/prototypes";
import type {
  PrototypeDesigns,
  PrototypeRecord,
  PrototypeSourceOption,
} from "../../application/prototypes";
import {
  invalidPrototypeBriefField,
  prototypeBriefFields,
  prototypeDesignFields,
  prototypeDesignKinds,
  prototypeSourceKey,
} from "../../domain/prototypes";
import type { PrototypeId, PrototypeSource } from "../../domain/prototypes";
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
import PrototypeDesignFields from "./PrototypeDesignFields.vue";
import PrototypeScopeSelect from "./PrototypeScopeSelect.vue";

const {
  projectId,
  source = undefined,
  base = undefined,
} = defineProps<{
  readonly projectId: ProjectId;
  readonly source?: PrototypeSource | undefined;
  readonly base?: PrototypeRecord | undefined;
}>();
const emit = defineEmits<{ dismiss: [PrototypeId?] }>();
const text = useMessages().prototypes;
const options = useAsyncStream<readonly PrototypeSourceOption[], never>(
  [],
  prototypeSourcesChanges(projectId),
);
const initialSource = base?.source ?? source;
const sourceKey = initialSource && prototypeSourceKey(initialSource);
const id = base?.id ?? useService(newPrototypeId);
const initialDesign: PrototypeDesigns = Object.fromEntries(
  prototypeDesignKinds.flatMap((kind) => {
    const noteId = base?.values[prototypeDesignFields[kind]];
    return noteId ? [[kind, { id: noteId }]] : [];
  }),
);
const command = useCommand(savePrototype);
const busy = command.pending;
const open = ref(true);
const drafting = ref(false);
const panel = ref<HTMLFormElement>();
const issue = ref<"scope" | "title" | "description">();
const errors = computed(() => (issue.value === "scope" ? undefined : command.message.value));
const fields = {
  title: { component: UInput, label: text.titleField, limit: 160, marker: sourceKey && "" },
  description: { component: UTextarea, label: text.description, limit: 12000, marker: undefined },
};
let saved: PrototypeId | undefined;
const modal = useModal(open, () => emit("dismiss", saved), close);
useNavigationGuard(() => !busy.value);

async function invalid(field: NonNullable<typeof issue.value>) {
  issue.value = field;
  await nextTick();
  panel.value?.querySelector<HTMLElement>(`[name="${field}"]`)?.focus();
}

const form = useForm({
  defaultValues: {
    title: base?.title ?? "",
    description: base?.description ?? "",
    scope: sourceKey ?? "",
    designs: initialDesign,
  },
  async onSubmit({ value }) {
    if (busy.value || drafting.value) return;
    issue.value = undefined;
    const selected = selectedScope(value.scope);
    if (!selected) return invalid("scope");
    const field = prototypeBriefFields.find((name) =>
      invalidPrototypeBriefField(name, value[name]),
    );
    if (field) return invalid(field);
    const result = await command.run(projectId, id, { ...value, source: selected }, base);
    if (result._tag === "success") {
      saved = result.value;
      close();
    } else if (sourceError(result)) {
      await invalid("scope");
    }
  },
});

function selectedScope(key: string) {
  if (key === sourceKey) return initialSource;
  return options.value.find((option) => prototypeSourceKey(option.source) === key)?.source;
}

function sourceError(result: Awaited<ReturnType<typeof command.run>>) {
  return (
    result._tag === "failure" &&
    result.error._tag === "PrototypeError" &&
    result.error.reason === "source"
  );
}

function close() {
  if (!busy.value && !drafting.value) open.value = false;
}
</script>

<template>
  <UModal
    :open="open"
    :title="base ? text.edit : text.create"
    :content="modal"
    :ui="{ ...leafModalUi, body: 'pe:min-w-0 pe:p-4' }"
    :dismissible="!busy"
    :close="false"
    @update:open="close"
  >
    <template #body>
      <form
        ref="panel"
        class="pe:grid pe:min-w-0 pe:gap-3"
        data-testid="prototype-form"
        novalidate
        @submit.prevent="form.handleSubmit"
      >
        <form.Field v-slot="{ field }" name="scope">
          <PrototypeScopeSelect
            :model-value="field.state.value"
            :options="options"
            :busy="busy"
            :invalid="issue === 'scope'"
            :autofocus="!sourceKey"
            @update:model-value="field.handleChange"
          />
        </form.Field>
        <form.Field
          v-for="name in prototypeBriefFields"
          :key="name"
          v-slot="{ field }"
          :name="name"
        >
          <UFormField
            :label="fields[name].label"
            :error="issue === name ? text.errors[name] : false"
          >
            <component
              :is="fields[name].component"
              :name="name"
              class="pe:w-full"
              :model-value="field.state.value"
              :readonly="busy"
              aria-required="true"
              :aria-invalid="issue === name"
              :maxlength="fields[name].limit"
              :data-autofocus="fields[name].marker"
              @update:model-value="(value: string) => field.handleChange(value)"
            />
          </UFormField>
        </form.Field>
        <form.Field v-slot="{ field }" name="designs">
          <PrototypeDesignFields
            :project-id="projectId"
            :value="field.state.value"
            :busy="busy"
            @change="field.handleChange"
            @drafting="drafting = $event"
          />
        </form.Field>
        <ErrorNotice v-if="errors" :message="errors" />
        <div class="pe:flex pe:flex-wrap pe:justify-end pe:gap-2">
          <UButton
            type="button"
            color="neutral"
            variant="ghost"
            :label="text.cancel"
            data-testid="prototype-cancel"
            :disabled="busy"
            @click="close"
          />
          <UButton type="submit" :loading="busy" :label="text.save" data-testid="prototype-save" />
        </div>
      </form>
    </template>
  </UModal>
</template>
