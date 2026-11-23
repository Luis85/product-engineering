<script setup lang="ts">
import UButton from "@nuxt/ui/components/Button.vue";
import { computed } from "vue";
import { useMarkdownHost, useMessages } from "../shell";

const {
  source,
  links,
  editable = false,
} = defineProps<{
  readonly source: string;
  readonly links: readonly {
    readonly link: string;
    readonly label: string;
    readonly original: string;
  }[];
  readonly editable?: boolean;
}>();
const emit = defineEmits<{ remove: [index: number] }>();
const host = useMarkdownHost();
const text = useMessages().knowledge.note;
const rows = computed(() =>
  links.map((entry) => {
    const target = host.resolve(entry.link, source);
    return {
      ...entry,
      supported: target?.supported,
      error: target ? text.unsupported : text.unresolved,
    };
  }),
);
</script>

<template>
  <ul v-if="rows.length" class="pe:grid pe:gap-2">
    <li v-for="(row, index) in rows" :key="index" class="pe-note-ref-row">
      <UButton
        v-if="row.supported"
        type="button"
        color="neutral"
        variant="link"
        :title="row.original"
        class="pe:wrap-anywhere pe:text-start"
        @click="host.open(row.link, source)"
        >{{ row.label }}</UButton
      >
      <span v-else :title="row.original"
        >{{ row.label }} <small class="pe:text-muted">{{ row.error }}</small></span
      >
      <UButton
        v-if="editable"
        type="button"
        color="neutral"
        variant="ghost"
        @click="emit('remove', index)"
        >{{ text.removeReference }}</UButton
      >
    </li>
  </ul>
  <p v-else class="pe:text-sm pe:text-muted">{{ text.noReferences }}</p>
</template>
