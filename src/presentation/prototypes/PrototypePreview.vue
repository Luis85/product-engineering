<script setup lang="ts">
import UButton from "@nuxt/ui/components/Button.vue";
import UIcon from "@nuxt/ui/components/Icon.vue";
import { computed, ref } from "vue";
import type { recordedPrototypeArtifact } from "../../application/prototypes";
import { useMessages } from "../shell";
import { legacyPrototypePreview, offlinePrototypePreview } from "./offline-preview";

const { artifact, title, legacy } = defineProps<{
  readonly artifact: NonNullable<ReturnType<typeof recordedPrototypeArtifact>>;
  readonly title: string;
  readonly legacy: boolean;
}>();
const emit = defineEmits<{ download: [MouseEvent] }>();
const text = useMessages().prototypes.output;
const browser = ref<HTMLElement>();
const html = computed(() => artifact.html);
const source = computed(() => {
  const owner = browser.value?.ownerDocument;
  if (!owner) return undefined;
  return legacy
    ? legacyPrototypePreview(owner, text.caseFields)
    : offlinePrototypePreview(owner, html.value);
});
</script>

<template>
  <section class="pe:grid pe:min-w-0 pe:gap-2">
    <header class="pe-prototype-header">
      <div>
        <h2 class="pe:font-semibold">{{ text.title }}</h2>
        <p v-if="!legacy" class="pe:text-sm pe:text-muted">
          {{ text.provenance[artifact.provenance] }}
        </p>
      </div>
      <UButton
        type="button"
        color="neutral"
        variant="soft"
        data-testid="prototype-export-html"
        :label="text.export"
        @click="emit('download', $event)"
      />
    </header>
    <section
      ref="browser"
      class="pe-prototype-browser"
      data-testid="prototype-browser"
      :aria-label="text.browser"
    >
      <div class="pe-prototype-browser-tab">
        <span class="pe-prototype-window-dots" aria-hidden="true"><i /><i /><i /></span>
        <span><UIcon name="i-lucide-panels-top-left" aria-hidden="true" />{{ title }}</span>
      </div>
      <div class="pe-prototype-browser-location">
        <span
          ><UIcon name="i-lucide-file" aria-hidden="true" />{{
            legacy ? "PT-03-rev2.html" : artifact.fileName
          }}</span
        >
        <small>{{ text.local }}</small>
      </div>
      <iframe
        v-if="source"
        data-testid="prototype-preview"
        :title="text.frame"
        :sandbox="legacy ? 'allow-scripts allow-downloads' : 'allow-scripts'"
        referrerpolicy="no-referrer"
        :srcdoc="source"
      />
    </section>
    <p v-if="!legacy" class="pe:text-xs pe:text-muted">{{ text.previewNote }}</p>
  </section>
</template>
