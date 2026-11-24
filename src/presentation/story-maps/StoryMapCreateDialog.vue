<script setup lang="ts">
import UButton from "@nuxt/ui/components/Button.vue";
import UFormField from "@nuxt/ui/components/FormField.vue";
import UInput from "@nuxt/ui/components/Input.vue";
import UModal from "@nuxt/ui/components/Modal.vue";
import UTextarea from "@nuxt/ui/components/Textarea.vue";
import { useForm } from "@tanstack/vue-form";
import { computed, nextTick, ref } from "vue";
import type { ProjectId } from "../../application/projects";
import { createStoryMap, newStoryMapId, storyMapPrefill } from "../../application/story-maps";
import type { KnowledgeId } from "../../domain/knowledge";
import { storyMapFieldInvalid, storyMapFields, storyMapLimits } from "../../domain/story-maps";
import type { StoryMapField, StoryMapId } from "../../domain/story-maps";
import { leafModalUi } from "../projects";
import {
  ErrorNotice,
  useCommand,
  useMessages,
  useModal,
  useNavigationGuard,
  useQuery,
  useService,
} from "../shell";

const {
  projectId,
  prdId = undefined,
  sourcePath = undefined,
} = defineProps<{
  readonly projectId: ProjectId;
  readonly prdId?: KnowledgeId;
  readonly sourcePath?: string;
}>();
const emit = defineEmits<{ dismiss: [StoryMapId?] }>();
const text = useMessages()["story-maps"];
const id = useService(newStoryMapId);
const command = useCommand(createStoryMap);
const open = ref(true);
const panel = ref<HTMLFormElement>();
const issue = ref<StoryMapField>();
let saved: StoryMapId | undefined;
const busy = command.pending;
const prefill = useQuery(storyMapPrefill);
const canSubmit = computed(() => !busy.value && (!prdId || Boolean(prefill.value.value)));
const modal = useModal(open, () => emit("dismiss", saved), close);
useNavigationGuard(() => !busy.value);

const form = useForm({
  defaultValues: { title: "", persona: "", goal: "" },
  async onSubmit({ value }) {
    if (!canSubmit.value) return;
    issue.value = storyMapFields.find((field) => storyMapFieldInvalid(field, value[field]));
    if (issue.value) {
      await nextTick();
      panel.value?.querySelector<HTMLElement>(`[name="${issue.value}"]`)?.focus();
      return;
    }
    if (
      (
        await command.run(
          { projectId, id, ...(prdId && { prdId }), ...(sourcePath && { sourcePath }) },
          value,
        )
      )._tag !== "success"
    )
      return;
    saved = id;
    close();
  },
});

if (prdId)
  void prefill.run(projectId, prdId, sourcePath).then((result) => {
    if (result._tag === "success") form.reset(result.value.draft);
  });

function close() {
  if (!busy.value) open.value = false;
}
</script>

<template>
  <UModal
    :open="open"
    :title="text.create"
    :description="text.intro"
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
        novalidate
        @submit.prevent="form.handleSubmit"
      >
        <p v-if="prefill.value.value" class="pe:wrap-anywhere pe:text-sm pe:text-muted">
          {{
            text.sourceLabel(prefill.value.value.source.title, prefill.value.value.source.displayId)
          }}
        </p>
        <form.Field v-for="name in storyMapFields" :key="name" v-slot="{ field }" :name="name">
          <UFormField
            :label="text.fields[name]"
            :error="issue === name ? text.invalid[name] : false"
          >
            <component
              :is="name === 'goal' ? UTextarea : UInput"
              :name="name"
              :model-value="field.state.value"
              :maxlength="storyMapLimits[name]"
              :readonly="!canSubmit"
              :data-autofocus="name === 'title' ? '' : undefined"
              :aria-invalid="issue === name ? 'true' : undefined"
              aria-required="true"
              class="pe:w-full"
              @update:model-value="(value: string) => field.handleChange(value)"
            />
          </UFormField>
        </form.Field>
        <ErrorNotice v-if="prefill.message.value" :message="prefill.message.value" />
        <ErrorNotice v-else-if="command.message.value" :message="command.message.value" />
        <div class="pe:flex pe:flex-wrap pe:justify-end pe:gap-2">
          <UButton
            type="button"
            color="neutral"
            variant="ghost"
            :disabled="busy"
            :label="text.cancel"
            data-testid="story-map-cancel"
            @click="close"
          />
          <UButton
            type="submit"
            :loading="busy"
            :disabled="!canSubmit"
            :label="text.create"
            data-testid="story-map-submit"
          />
        </div>
      </form>
    </template>
  </UModal>
</template>
