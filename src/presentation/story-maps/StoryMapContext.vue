<script setup lang="ts">
import UIcon from "@nuxt/ui/components/Icon.vue";
import { ref, useId } from "vue";
import { useMessages } from "../shell";

const parts = ["foundations", "prototypes", "nfrs", "entities"] as const;
type Part = (typeof parts)[number];
const { counts, initial = undefined } = defineProps<{
  readonly counts: Readonly<Record<Part, number>>;
  readonly initial?: Part | undefined;
}>();
const icons = {
  foundations: "book-open",
  prototypes: "layout-grid",
  nfrs: "check",
  entities: "network",
};
const active = ref<Part | undefined>(initial);
const id = useId();
const text = useMessages()["story-maps"].context;
</script>

<template>
  <div class="pe-story-context">
    <div class="pe-story-context-controls" role="group" :aria-label="text.label">
      <button
        v-for="part in parts"
        :key="part"
        type="button"
        class="pe-story-context-toggle"
        :aria-expanded="active === part"
        :aria-controls="id + '-' + part"
        :data-testid="'story-map-context-' + part"
        @click="active = active === part ? undefined : part"
      >
        <UIcon :name="'i-lucide-' + icons[part]" aria-hidden="true" />
        <span>{{ text[part] }}</span>
        <span class="pe-story-context-count">{{ counts[part] }}</span>
      </button>
    </div>
    <section
      v-for="part in parts"
      :id="id + '-' + part"
      :key="part"
      :hidden="active !== part"
      :aria-label="text[part]"
      class="pe-story-context-panel"
    >
      <slot v-if="active === part" :name="part" />
    </section>
  </div>
</template>
