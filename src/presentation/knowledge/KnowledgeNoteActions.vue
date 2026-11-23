<script setup lang="ts">
import UButton from "@nuxt/ui/components/Button.vue";
import { nextTick, ref, useId } from "vue";
import { readKnowledgeNote } from "../../application/knowledge";
import type { KnowledgeNote } from "../../application/knowledge";
import { openProjectIntegrationSettings } from "../../application/projects";
import { useCommand, useMessages, useQuery } from "../shell";

const { note } = defineProps<{ readonly note: KnowledgeNote }>();
const text = useMessages().knowledge.note;
const open = ref(false);
const id = useId();
const actionGroup = ref<HTMLElement>();
const trigger = ref<{ $el: HTMLElement }>();
const exportButton = ref<{ $el: HTMLElement }>();
const query = useQuery(readKnowledgeNote);
const aiSettings = useCommand(openProjectIntegrationSettings);

async function toggle() {
  open.value = !open.value;
  if (!open.value) return;
  await nextTick();
  exportButton.value?.$el.focus({ preventScroll: true });
}

function close() {
  if (!open.value) return;
  open.value = false;
  trigger.value?.$el.focus({ preventScroll: true });
}

function checkFocus(event: FocusEvent) {
  if (!event.relatedTarget || !actionGroup.value?.contains(event.relatedTarget as Node)) {
    open.value = false;
  }
}

async function exportNote() {
  const owner = actionGroup.value?.ownerDocument;
  const browser = owner?.defaultView;
  if (!owner || !browser) return;
  const result = await query.run(note.projectId, note.id, note.path);
  if (result._tag !== "success") return;
  const { path, text: markdown } = result.value;
  const link = owner.createElement("a");
  const url = browser.URL.createObjectURL(
    new browser.Blob([markdown], { type: "text/markdown;charset=utf-8" }),
  );
  link.href = url;
  link.download = path.slice(path.lastIndexOf("/") + 1);
  link.click();
  browser.setTimeout(() => browser.URL.revokeObjectURL(url), 0);
  close();
}

async function reviewSettings() {
  close();
  await aiSettings.run();
}
</script>

<template>
  <div
    ref="actionGroup"
    class="pe:relative pe:min-w-0"
    @focusout="checkFocus"
    @keydown.esc.stop="close"
  >
    <UButton
      ref="trigger"
      type="button"
      color="neutral"
      variant="outline"
      data-testid="knowledge-note-actions"
      :aria-expanded="open"
      :aria-controls="id"
      @click="toggle"
      :label="text.actions"
    />
    <div
      v-if="open"
      :id="id"
      class="pe-note-menu"
      :aria-label="text.actions"
      data-testid="knowledge-action-panel"
    >
      <UButton
        ref="exportButton"
        type="button"
        variant="ghost"
        color="neutral"
        data-testid="knowledge-export"
        :loading="query.pending.value"
        @click="exportNote"
        :label="text.export"
      />
      <UButton
        type="button"
        variant="ghost"
        color="neutral"
        data-testid="knowledge-ai-settings"
        @click="reviewSettings"
        :label="text.aiSettings"
      />
    </div>
    <p v-if="query.message.value" role="alert" class="pe:text-xs pe:text-error">
      {{ query.message.value.title }}
    </p>
    <p v-if="aiSettings.message.value" role="alert" class="pe:text-xs pe:text-error">
      {{ aiSettings.message.value.title }}
    </p>
  </div>
</template>
