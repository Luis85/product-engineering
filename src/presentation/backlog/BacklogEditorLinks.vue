<script setup lang="ts">
import UButton from "@nuxt/ui/components/Button.vue";
import type { ProjectId } from "../../application/projects";
import { useMessages } from "../shell";
import NfrSourceLinks from "./nfr/NfrSourceLinks.vue";
import StoryMapItemLinks from "./StoryMapItemLinks.vue";

defineProps<{
  readonly project: ProjectId;
  readonly item: string | undefined;
  readonly adopted: boolean;
  readonly opening: boolean;
  readonly adopting: boolean;
}>();
const emit = defineEmits<{ open: [MouseEvent]; adopt: [MouseEvent] }>();
const text = useMessages().backlog;
</script>

<template>
  <section :aria-label="text.related" class="pe-backlog-editor-section">
    <h3 class="pe:text-sm pe:font-semibold">{{ text.related }}</h3>
    <slot />
    <StoryMapItemLinks :project="project" :item="item" />
    <NfrSourceLinks :project="project" :item-id="item" />
    <div class="pe-backlog-actions">
      <UButton
        type="button"
        variant="soft"
        color="neutral"
        data-testid="backlog-open-note"
        :label="text.nativeNote"
        :loading="opening"
        @click="emit('open', $event)"
      />
      <UButton
        v-if="!adopted"
        type="button"
        variant="soft"
        color="neutral"
        data-testid="backlog-adopt"
        :label="text.adopt"
        :loading="adopting"
        @click="emit('adopt', $event)"
      />
    </div>
  </section>
</template>
