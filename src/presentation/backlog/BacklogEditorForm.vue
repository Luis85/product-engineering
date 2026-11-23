<script setup lang="ts">
import UButton from "@nuxt/ui/components/Button.vue";
import { nextTick, ref } from "vue";
import type { BacklogDraft, BacklogItem, BacklogPlacement } from "../../application/backlog";
import type { BacklogBase, ProjectMember } from "../../application/projects";
import type { BacklogKind } from "../../domain/backlog";
import { KnowledgeMarkdown, KnowledgeNoteEditor } from "../knowledge";
import { useMessages } from "../shell";
import BacklogFields from "./BacklogFields.vue";
import BacklogPosition from "./BacklogPosition.vue";

type EditorDraft = BacklogDraft & { epic: string; epicTitle: string; featureTitle: string };
const {
  id,
  kind,
  items,
  base,
  members,
  creating,
  busy,
  draft,
  invalidTitle,
  item,
  level,
  path,
  fixedParent,
} = defineProps<{
  readonly id: string;
  readonly kind: BacklogKind;
  readonly items: readonly BacklogItem[];
  readonly base: BacklogBase;
  readonly members: readonly ProjectMember[];
  readonly creating: boolean;
  readonly busy: boolean;
  readonly draft: EditorDraft;
  readonly invalidTitle: boolean;
  readonly item: BacklogItem | undefined;
  readonly level: BacklogKind | "";
  readonly path: string;
  readonly fixedParent: boolean;
}>();
const emit = defineEmits<{ field: [keyof EditorDraft, string]; submit: [] }>();
const editing = defineModel<boolean>("editing", { required: true });
const placement = defineModel<BacklogPlacement | undefined>("placement", { required: true });
const editor = ref<InstanceType<typeof KnowledgeNoteEditor>>();
const text = useMessages().backlog;
async function showDescriptionEditor() {
  editing.value = true;
  await nextTick();
  await editor.value?.focus();
}
</script>

<template>
  <form
    :id="id"
    novalidate
    data-testid="backlog-form"
    class="pe:grid pe:min-w-0 pe:gap-4"
    @submit.prevent="emit('submit')"
  >
    <BacklogFields
      :kind="kind"
      :items="items"
      :base="base"
      :members="members"
      :creating="creating"
      :disabled="busy"
      :fixed-parent="fixedParent"
      :title="draft.title"
      :parent="draft.parent"
      :state="draft.state"
      :priority="draft.priority"
      :owner="draft.owner"
      :epic="draft.epic"
      :epic-title="draft.epicTitle"
      :feature-title="draft.featureTitle"
      @update:title="emit('field', 'title', $event)"
      @update:parent="emit('field', 'parent', $event)"
      @update:state="emit('field', 'state', $event)"
      @update:priority="emit('field', 'priority', $event)"
      @update:owner="emit('field', 'owner', $event)"
      @update:epic="emit('field', 'epic', $event)"
      @update:epic-title="emit('field', 'epicTitle', $event)"
      @update:feature-title="emit('field', 'featureTitle', $event)"
    />
    <p v-if="invalidTitle" role="alert">
      {{ text.errors.title }}
    </p>
    <BacklogPosition
      v-if="item && !fixedParent"
      v-model="placement"
      :item="item"
      :items="items"
      :parent="draft.parent"
      :level="level"
      :disabled="busy"
    />
    <section :aria-label="text.notes" class="pe-backlog-editor-section">
      <div class="pe-backlog-actions">
        <h3 class="pe:text-sm pe:font-semibold">{{ text.notes }}</h3>
        <UButton
          v-if="!editing"
          type="button"
          variant="ghost"
          color="neutral"
          size="sm"
          data-testid="backlog-edit-description"
          :label="text.editNotes"
          @click="showDescriptionEditor"
        />
      </div>
      <KnowledgeNoteEditor
        v-if="editing"
        ref="editor"
        :model-value="draft.body"
        :path="path"
        :accessible-label="text.notes"
        :saving="busy"
        @update:model-value="emit('field', 'body', $event)"
      />
      <KnowledgeMarkdown v-else-if="draft.body" :body="draft.body" :path="path" />
      <p v-else class="pe:text-sm pe:text-muted">{{ text.noDescription }}</p>
    </section>
  </form>
</template>
