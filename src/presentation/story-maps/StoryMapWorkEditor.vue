<script setup lang="ts">
import UButton from "@nuxt/ui/components/Button.vue";
import UInput from "@nuxt/ui/components/Input.vue";
import UModal from "@nuxt/ui/components/Modal.vue";
import UTextarea from "@nuxt/ui/components/Textarea.vue";
import { useForm } from "@tanstack/vue-form";
import { computed, ref } from "vue";
import { companionKinds, newBacklogCreation, saveBacklogItem } from "../../application/backlog";
import type {
  BacklogCreation,
  BacklogEdit,
  BacklogItem,
  BacklogSnapshot,
  CompanionKind,
} from "../../application/backlog";
import { projectMemberChoices } from "../../application/projects";
import { saveStoryMapWork } from "../../application/story-maps";
import type { StoryMapRecord } from "../../application/story-maps";
import { mappedBoardStage, validBacklogTitle } from "../../domain/backlog";
import type { StoryMapCard, StoryMapWork } from "../../domain/story-maps";
import { leafModalUi } from "../projects";
import {
  ErrorNotice,
  useCommand,
  useMessages,
  useModal,
  useNavigationGuard,
  useQuery,
} from "../shell";

const {
  map,
  card,
  backlog,
  parents,
  owned = undefined,
  existing = undefined,
} = defineProps<{
  readonly map: StoryMapRecord;
  readonly card: StoryMapCard;
  readonly backlog: BacklogSnapshot;
  readonly parents: readonly BacklogItem[];
  readonly owned?: StoryMapWork | undefined;
  readonly existing?: BacklogEdit | undefined;
}>();
const emit = defineEmits<{ dismiss: [] }>();
const catalog = useMessages();
const text = catalog["story-maps"];
const backlogText = catalog.backlog;
const base = map;
const open = ref(true);
const creation = useQuery(newBacklogCreation);
const store = useCommand(saveStoryMapWork);
const update = useCommand(saveBacklogItem);
const team = useQuery(projectMemberChoices);
void team.run(base.projectId);
const pending = computed(
  () => creation.pending.value || store.pending.value || update.pending.value,
);
const message = computed(() => store.message.value ?? update.message.value);
const modal = useModal(open, () => emit("dismiss"), close);
useNavigationGuard(() => !pending.value);
const invalid = ref(false);
const stateOptions = computed(() => backlog.base?.states ?? []);
const priorities = computed(() => backlog.base?.priorities ?? []);
let identity: { readonly kind: CompanionKind; readonly creation: BacklogCreation } | undefined;
const before = owned ?? existing?.draft;

const form = useForm({
  defaultValues: {
    kind:
      owned?.kind ??
      companionKinds.find((kind) => kind === existing?.item.kind) ??
      ("TASK" as CompanionKind),
    title: before?.title ?? "",
    body: before?.body ?? "",
    state: before?.state ?? mappedBoardStage("Open", stateOptions.value),
    priority: before?.priority ?? "",
    owner: before?.owner ?? "",
    destination:
      existing?.draft.parent ??
      (owned || !parents.length ? "story" : parents.length === 1 ? (parents[0]?.id ?? "") : ""),
  },
  async onSubmit({ value }) {
    invalid.value = !validBacklogTitle(value.title.trim()) || !value.destination;
    if (!invalid.value && (await persist(value))) close();
  },
});

type WorkDraft = Pick<StoryMapWork, "kind" | "title" | "body" | "state" | "priority" | "owner"> & {
  readonly destination: string;
};

async function operationFor(kind: CompanionKind) {
  if (identity?.kind !== kind) {
    const next = await creation.run(kind);
    if (next._tag !== "success") return;
    identity = { kind, creation: next.value };
  }
  return identity.creation;
}

async function persist(value: WorkDraft) {
  const { destination, ...draft } = value;
  if (existing) {
    const result = await update.run(base.projectId, existing, {
      ...draft,
      parent: existing.draft.parent,
    });
    return result._tag === "success";
  }
  const operation = await operationFor(draft.kind);
  if (!operation) return false;
  const { id, record } = operation.item;
  const result = await store.run(
    base,
    {
      ...draft,
      cardId: card.id,
      id: owned?.id ?? id,
      recordId: owned?.recordId ?? record,
    },
    destination,
    operation,
  );
  return result._tag === "success";
}

const selected = form.useStore(({ values }) => values);
const selectionFields = ["state", "priority", "owner"] as const;
const emptyChoice = {
  state: backlogText.unset,
  priority: backlogText.unset,
  owner: backlogText.unassigned,
};

function options(list: readonly string[], current: string) {
  return Array.from(new Set([...list, current].filter(Boolean))).map((value) => ({
    value,
    label: value,
  }));
}

const owners = computed(() => {
  const choices = (team.value.value ?? []).map(({ id, name }) => ({
    value: existing ? name : id,
    label: name,
  }));
  const value = selected.value.owner;
  return value && !choices.some((choice) => choice.value === value)
    ? [...choices, { value, label: value }]
    : choices;
});
const choices = computed(() => ({
  state: options(stateOptions.value, selected.value.state),
  priority: options(priorities.value, selected.value.priority),
  owner: owners.value,
}));
const dialogTitle = before ? text.work.edit : text.work.add;

function close() {
  if (!pending.value) open.value = false;
}
</script>

<template>
  <UModal
    :open="open"
    :title="dialogTitle"
    :description="card.title"
    :content="modal"
    :ui="leafModalUi"
    :dismissible="!pending"
    :close="false"
    @update:open="close"
  >
    <template #body>
      <form class="pe:grid pe:min-w-0 pe:gap-3" novalidate @submit.prevent="form.handleSubmit()">
        <form.Field v-if="!before" v-slot="{ field }" name="kind">
          <label class="pe:grid pe:gap-1">
            {{ text.work.kind }}
            <select
              name="kind"
              class="pe:w-full pe:min-w-0"
              :value="field.state.value"
              :disabled="pending"
              @change="
                field.handleChange(($event.target as HTMLSelectElement).value as CompanionKind)
              "
            >
              <option v-for="kind in companionKinds" :key="kind" :value="kind">
                {{ backlogText.types[kind] }}
              </option>
            </select>
          </label>
        </form.Field>
        <form.Field v-slot="{ field }" name="title">
          <label class="pe:grid pe:gap-1">
            {{ text.journey.nodeTitle.activity }}
            <UInput
              name="title"
              :model-value="field.state.value"
              maxlength="160"
              data-autofocus
              :disabled="pending"
              @update:model-value="field.handleChange($event)"
            />
          </label>
        </form.Field>
        <form.Field v-slot="{ field }" name="body">
          <label class="pe:grid pe:gap-1">
            {{ text.work.description }}
            <UTextarea
              name="body"
              :model-value="field.state.value"
              :disabled="pending"
              @update:model-value="field.handleChange($event)"
            />
          </label>
        </form.Field>
        <p v-if="existing">{{ text.work.destination }} · {{ existing.draft.parent }}</p>
        <form.Field v-else v-slot="{ field }" name="destination">
          <label class="pe:grid pe:gap-1">
            {{ text.work.destination }}
            <select
              name="destination"
              class="pe:w-full pe:min-w-0"
              :value="field.state.value"
              :disabled="pending"
              @change="field.handleChange(($event.target as HTMLSelectElement).value)"
            >
              <option value="" disabled>{{ text.work.choose }}</option>
              <option value="story">{{ text.work.storyOnly }}</option>
              <option v-for="parent in parents" :key="parent.key" :value="parent.id">
                {{ parent.id }} · {{ parent.title }}
              </option>
            </select>
          </label>
        </form.Field>
        <div class="pe-story-work-fields">
          <form.Field v-for="name in selectionFields" :key="name" v-slot="{ field }" :name="name">
            <label class="pe:grid pe:gap-1">
              {{ text.work[name] }}
              <select
                :name="name"
                class="pe:w-full pe:min-w-0"
                :value="field.state.value"
                :disabled="pending"
                @change="field.handleChange(($event.target as HTMLSelectElement).value)"
              >
                <option value="">{{ emptyChoice[name] }}</option>
                <option v-for="option in choices[name]" :key="option.value" :value="option.value">
                  {{ option.label }}
                </option>
              </select>
            </label>
          </form.Field>
        </div>
        <p v-if="invalid" role="alert">{{ text.work.invalid }}</p>
        <ErrorNotice v-if="message" :message="message" />
        <div class="pe:flex pe:flex-wrap pe:justify-end pe:gap-2">
          <UButton
            type="button"
            color="neutral"
            variant="ghost"
            :label="text.cancel"
            :disabled="pending"
            @click="close"
          />
          <UButton
            type="submit"
            :label="text.journey.save"
            :loading="pending"
            data-testid="story-map-work-save"
          />
        </div>
      </form>
    </template>
  </UModal>
</template>
