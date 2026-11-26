<script setup lang="ts">
import UButton from "@nuxt/ui/components/Button.vue";
import { computed, ref } from "vue";
import { knowledgeChanges, knowledgeSnapshot, projectKnowledge } from "../../application/knowledge";
import type { KnowledgeDraft } from "../../application/knowledge";
import type { ProjectId } from "../../application/projects";
import type { PrototypeDesign, PrototypeDesigns } from "../../application/prototypes";
import { isKnowledgeId } from "../../domain/knowledge";
import type { KnowledgeId } from "../../domain/knowledge";
import { prototypeDesignKinds } from "../../domain/prototypes";
import type { PrototypeDesignKind } from "../../domain/prototypes";
import { KnowledgeCreateDialog } from "../knowledge";
import { useMessages, useStream } from "../shell";

const { projectId, value, busy } = defineProps<{
  readonly projectId: ProjectId;
  readonly value: PrototypeDesigns;
  readonly busy: boolean;
}>();
const emit = defineEmits<{ change: [PrototypeDesigns]; drafting: [boolean] }>();
const catalogs = useMessages();
const text = catalogs.prototypes;
const labels = catalogs.projects.templates.labels;
const knowledge = useStream(knowledgeSnapshot, knowledgeChanges);
const documents = computed(() => projectKnowledge(projectId, knowledge.value.records));
const drafting = ref<PrototypeDesignKind>();
const reserved: Partial<Record<PrototypeDesignKind, KnowledgeId>> = {};
let trigger: HTMLElement | undefined;

function choicesFor(kind: PrototypeDesignKind) {
  const selected = value[kind];
  const choices = documents.value
    .filter((note) => note.kind === kind)
    .map((note) => ({ id: note.id, label: `${note.displayId} · ${note.title}` }));
  if (!selected) return choices;
  if (selected.draft)
    return [
      { id: selected.id, label: text.draftLabel(selected.draft.title) },
      ...choices.filter(({ id }) => id !== selected.id),
    ];
  if (!choices.some(({ id }) => id === selected.id))
    choices.push({ id: selected.id, label: text.missingSource });
  return choices;
}

const fields = computed(() =>
  prototypeDesignKinds.map((kind) => ({
    kind,
    label: labels[kind],
    selected: value[kind]?.id ?? "",
    choices: choicesFor(kind),
  })),
);

function update(kind: PrototypeDesignKind, selection?: PrototypeDesign) {
  emit("change", { ...value, [kind]: selection });
}

function select(kind: PrototypeDesignKind, event: Event) {
  const id = (event.currentTarget as HTMLSelectElement).value;
  if (id === value[kind]?.id) return;
  update(kind, isKnowledgeId(id) ? { id } : undefined);
}

function start(kind: PrototypeDesignKind, event: MouseEvent) {
  trigger = event.currentTarget as HTMLElement;
  drafting.value = kind;
  emit("drafting", true);
}

function stage(kind: PrototypeDesignKind) {
  const previous = value[kind]?.draft;
  return {
    id: reserved[kind],
    title: previous?.title ?? "",
    body: previous?.body ?? "",
    dialogTitle: text.draftDesign(labels[kind]),
    bodyLabel: text.body,
    submit: text.includeDraft,
    invalidTitle: text.invalidTitle,
    invalidBody: text.noContent,
    save(id: KnowledgeId, draft: KnowledgeDraft) {
      reserved[kind] = id;
      update(kind, { id, draft });
    },
  };
}

function close() {
  drafting.value = undefined;
  emit("drafting", false);
  trigger?.focus({ preventScroll: true });
}
</script>

<template>
  <fieldset class="pe-prototype-design">
    <legend class="pe:text-sm pe:font-medium">{{ text.design }}</legend>
    <div
      v-for="{ kind, label, selected, choices } in fields"
      :key="kind"
      class="pe:grid pe:min-w-0 pe:gap-1"
    >
      <label class="pe:grid pe:min-w-0 pe:gap-1 pe:text-sm">
        <span class="pe:font-medium">{{ label }}</span>
        <select
          :name="kind"
          class="pe-prototype-select"
          :disabled="busy"
          :value="selected"
          @change="select(kind, $event)"
        >
          <option value="">{{ text.noDesign }}</option>
          <option v-for="option in choices" :key="option.id" :value="option.id">
            {{ option.label }}
          </option>
        </select>
      </label>
      <UButton
        type="button"
        size="xs"
        color="neutral"
        variant="link"
        class="pe:justify-self-start pe:p-0"
        :label="text.draftDesign(labels[kind])"
        :disabled="busy"
        :data-testid="'prototype-draft-' + kind"
        @click="start(kind, $event)"
      />
    </div>
  </fieldset>
  <KnowledgeCreateDialog
    v-if="drafting"
    :project-id="projectId"
    :initial-template="drafting"
    :lock-template="true"
    :stage="stage(drafting)"
    @dismiss="close"
  />
</template>
