<script setup lang="ts">
import UButton from "@nuxt/ui/components/Button.vue";
import UInput from "@nuxt/ui/components/Input.vue";
import UModal from "@nuxt/ui/components/Modal.vue";
import UTextarea from "@nuxt/ui/components/Textarea.vue";
import { useForm } from "@tanstack/vue-form";
import { computed, ref } from "vue";
import { newStoryMapNodeId, saveStoryMapNode } from "../../application/story-maps";
import type { StoryMapNodeEdit, StoryMapRecord } from "../../application/story-maps";
import { validBacklogTitle } from "../../domain/backlog";
import { leafModalUi } from "../projects";
import {
  ErrorNotice,
  useCommand,
  useMessages,
  useModal,
  useNavigationGuard,
  useService,
} from "../shell";

const { map, edit } = defineProps<{
  readonly map: StoryMapRecord;
  readonly edit: StoryMapNodeEdit;
}>();
const emit = defineEmits<{ dismiss: [id?: string] }>();
const text = useMessages()["story-maps"];
const { kind, node } = edit;
const title = node.id ? text.journey.edit[kind] : text.journey.add[kind];
const id = node.id || useService(newStoryMapNodeId);
const base = map;
const open = ref(true);
let saved: string | undefined;
const { pending, message, run: save } = useCommand(saveStoryMapNode);
const modal = useModal(open, () => emit("dismiss", saved), close);
useNavigationGuard(() => !pending.value);
const titleInvalid = ref(false);

const form = useForm({
  defaultValues: {
    title: node.title,
    detail:
      edit.kind === "card"
        ? (edit.node.description ?? "")
        : edit.kind === "slice"
          ? (edit.node.outcome ?? "")
          : "",
    stepId: edit.kind === "card" ? edit.node.stepId : "",
    sliceId: edit.kind === "card" ? (edit.node.sliceId ?? "") : "",
  },
  async onSubmit({ value }) {
    titleInvalid.value = !validBacklogTitle(value.title.trim());
    if (titleInvalid.value) return;
    const name = { id, title: value.title };
    const change: StoryMapNodeEdit = {
      activity: () => ({ kind: "activity", node: name }),
      step: () => ({
        kind: "step",
        node: { ...name, activityId: edit.kind === "step" ? edit.node.activityId : "" },
      }),
      slice: () => ({ kind: "slice", node: { ...name, outcome: value.detail } }),
      card: () => ({
        kind: "card",
        node: {
          ...name,
          stepId: value.stepId,
          description: value.detail,
          ...(value.sliceId && { sliceId: value.sliceId }),
        },
      }),
    }[kind]() as StoryMapNodeEdit;
    const result = await save(base, change);
    if (result._tag === "success") {
      saved = id;
      close();
    }
  },
});
const steps = computed(() =>
  map.activities.flatMap((activity) =>
    map.steps
      .filter(({ activityId }) => activityId === activity.id)
      .map(({ id: stepId, title: stepTitle }) => ({
        id: stepId,
        title: activity.title + " / " + stepTitle,
      })),
  ),
);

function close() {
  if (!pending.value) open.value = false;
}
</script>

<template>
  <UModal
    :open="open"
    :title="title"
    :content="modal"
    :ui="leafModalUi"
    :dismissible="!pending"
    :close="false"
    @update:open="close"
  >
    <template #body>
      <form class="pe:grid pe:min-w-0 pe:gap-3" novalidate @submit.prevent="form.handleSubmit()">
        <form.Field v-slot="{ field }" name="title">
          <label class="pe:grid pe:gap-1">
            {{ text.journey.nodeTitle[kind] }}
            <UInput
              name="title"
              :model-value="field.state.value"
              :aria-invalid="titleInvalid"
              :maxlength="160"
              data-autofocus
              @update:model-value="field.handleChange($event)"
            />
          </label>
        </form.Field>
        <form.Field v-if="kind === 'card' || kind === 'slice'" v-slot="{ field }" name="detail">
          <label class="pe:grid pe:gap-1">
            {{ kind === "card" ? text.journey.need : text.journey.outcome }}
            <UTextarea
              name="detail"
              :model-value="field.state.value"
              :maxlength="kind === 'card' ? 500 : 300"
              @update:model-value="field.handleChange($event)"
            />
          </label>
        </form.Field>
        <template v-if="kind === 'card'">
          <form.Field v-slot="{ field }" name="stepId">
            <label class="pe:grid pe:gap-1">
              {{ text.journey.step }}
              <select
                name="stepId"
                class="pe:w-full pe:min-w-0"
                :value="field.state.value"
                @change="field.handleChange(($event.target as HTMLSelectElement).value)"
              >
                <option v-for="step in steps" :key="step.id" :value="step.id">
                  {{ step.title }}
                </option>
              </select>
            </label>
          </form.Field>
          <form.Field v-slot="{ field }" name="sliceId">
            <label class="pe:grid pe:gap-1">
              {{ text.journey.slice }}
              <select
                name="sliceId"
                class="pe:w-full pe:min-w-0"
                :value="field.state.value"
                @change="field.handleChange(($event.target as HTMLSelectElement).value)"
              >
                <option value="">{{ text.journey.unsliced }}</option>
                <option v-for="slice in map.slices" :key="slice.id" :value="slice.id">
                  {{ slice.title }}
                </option>
              </select>
            </label>
          </form.Field>
        </template>
        <p v-if="titleInvalid" role="alert">{{ text.journey.invalidTitle }}</p>
        <ErrorNotice v-if="message" :message="message" />
        <div class="pe:flex pe:flex-wrap pe:justify-end pe:gap-2">
          <UButton
            type="button"
            variant="ghost"
            color="neutral"
            :disabled="pending"
            :label="text.cancel"
            @click="close"
          />
          <UButton
            type="submit"
            :loading="pending"
            :label="text.journey.save"
            data-testid="story-map-journey-save"
          />
        </div>
      </form>
    </template>
  </UModal>
</template>
