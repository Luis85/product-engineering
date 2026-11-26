<script setup lang="ts">
import { ref, watchEffect } from "vue";
import { useMarkdownHost, useMessages } from "../shell";

const { body, path } = defineProps<{ readonly body: string; readonly path: string }>();
const host = useMarkdownHost();
const text = useMessages().knowledge.note;
const target = ref<HTMLElement>();
const failed = ref(false);
watchEffect((cleanup) => {
  const element = target.value;
  if (!element) return;
  const controller = new AbortController();
  cleanup(() => controller.abort());
  failed.value = false;
  void host.render(body, path, element, controller.signal).catch(() => {
    if (!controller.signal.aborted) failed.value = true;
  });
});
</script>

<template>
  <div v-if="failed" role="alert">{{ text.previewFailed }}</div>
  <div
    ref="target"
    class="markdown-rendered pe-note-body"
    data-testid="knowledge-body"
    :data-markdown-source="path"
  />
</template>
