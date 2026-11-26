<script setup lang="ts">
import UButton from "@nuxt/ui/components/Button.vue";
import { computed, nextTick, ref } from "vue";
import {
  knowledgeChanges,
  knowledgeDetailRoute,
  knowledgeRelationships,
  knowledgeSnapshot,
} from "../../application/knowledge";
import type {
  KnowledgeKind,
  KnowledgeNote,
  KnowledgeOrigin,
  KnowledgeRecord,
} from "../../application/knowledge";
import type { Note } from "../../application/notes";
import { useMessages, useNavigate, useStream } from "../shell";
import KnowledgeCreateDialog from "./KnowledgeCreateDialog.vue";
import { useKnowledgeDraftNavigation } from "./draft-navigation";

const { note, canCreate } = defineProps<{
  readonly note: KnowledgeNote;
  readonly canCreate: boolean;
}>();
const text = useMessages().knowledge.note;
const navigate = useNavigate();
const { openDraft } = useKnowledgeDraftNavigation();
const indexed = useStream(knowledgeSnapshot, knowledgeChanges);
const related = computed(() => knowledgeRelationships(note, indexed.value.records));
const applicableVisions = computed(() => {
  const linked = related.value.backlinks.filter(({ kind }) => kind === "vision");
  return linked.length ? linked : related.value.visions;
});
const defaultVision = computed(() =>
  applicableVisions.value.length === 1 ? applicableVisions.value[0]?.id : undefined,
);
const contextualActions = computed(() => {
  if (note.kind === "jtbd")
    return [
      "research",
      "prd",
      ...(applicableVisions.value.length ? [] : ["vision"]),
    ] as KnowledgeKind[];
  return note.kind === "vision" ? (["prd"] as const) : [];
});
const origin = computed<KnowledgeOrigin>(() => ({
  kind: note.kind === "vision" ? "vision" : "job",
  projectId: note.projectId,
  recordId: note.id,
}));
const hasRelations = computed(
  () =>
    contextualActions.value.length ||
    related.value.sources.length ||
    related.value.backlinks.length ||
    related.value.visions.length,
);
const returnTo = computed(() => ({
  section: "knowledge-note",
  reference: { kind: "knowledge", recordId: note.id },
}));
const creation = ref<KnowledgeKind>();
let creator: HTMLElement | undefined;

function start(kind: KnowledgeKind, event: MouseEvent) {
  creator = event.currentTarget as HTMLElement;
  creation.value = kind;
}

async function close() {
  creation.value = undefined;
  await nextTick();
  creator?.focus({ preventScroll: true });
}

function view(target: KnowledgeRecord) {
  return navigate(knowledgeDetailRoute(note.projectId, target.id, returnTo.value));
}

async function created(target: Note) {
  creation.value = undefined;
  await openDraft(target, note.projectId, returnTo.value, creator);
}
</script>

<template>
  <section
    v-if="hasRelations"
    class="pe:grid pe:min-w-0 pe:gap-3"
    data-testid="knowledge-relations"
  >
    <h2 class="pe:text-base pe:font-semibold">{{ text.productRelations }}</h2>
    <div v-if="contextualActions.length" class="pe-note-actions">
      <UButton
        v-for="kind in contextualActions"
        :key="kind"
        type="button"
        variant="soft"
        :disabled="!canCreate"
        :data-testid="'knowledge-create-' + kind"
        :data-pe-focus-key="'knowledge-create-' + kind"
        @click="start(kind, $event)"
        >{{ text.derive[kind as keyof typeof text.derive] }}</UButton
      >
    </div>
    <div
      v-for="group in ['sources', 'backlinks', 'visions'] as const"
      v-show="related[group].length"
      :key="group"
      class="pe:grid pe:gap-1"
      :data-knowledge-relation-group="group"
    >
      <h3 class="pe:text-sm pe:font-medium pe:text-muted">{{ text[group] }}</h3>
      <ul class="pe:grid pe:gap-1">
        <li v-for="target in related[group]" :key="target.id">
          <UButton
            type="button"
            color="neutral"
            variant="link"
            class="pe:wrap-anywhere pe:text-start"
            :data-knowledge-relation="target.id"
            :data-pe-focus-key="'knowledge-relation-' + target.id"
            @click="view(target)"
            >{{ target.title }} · {{ target.displayId }}</UButton
          >
        </li>
      </ul>
    </div>
    <KnowledgeCreateDialog
      v-if="creation"
      :project-id="note.projectId"
      :initial-template="creation"
      :initial-vision="defaultVision"
      :origin="origin"
      :on-created="created"
      @dismiss="close"
    />
  </section>
</template>
