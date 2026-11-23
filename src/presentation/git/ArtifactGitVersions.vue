<script setup lang="ts">
import UButton from "@nuxt/ui/components/Button.vue";
import type { GitRevision } from "../../application/git";
import { useMessages } from "../shell";

const { entries, selected } = defineProps<{
  readonly entries: readonly GitRevision[];
  readonly selected: string | undefined;
}>();
const emit = defineEmits<{ select: [oid?: string] }>();
const text = useMessages().git;
</script>

<template>
  <section :aria-label="text.versions" data-testid="git-versions" class="pe:min-w-0">
    <UButton
      type="button"
      variant="ghost"
      color="neutral"
      :aria-pressed="!selected"
      data-testid="git-working"
      :label="text.compareWorking"
      @click="emit('select')"
    />
    <ol v-if="entries.length" class="pe-git-versions">
      <li v-for="entry in entries" :key="entry.oid">
        <button
          class="pe-git-version"
          type="button"
          :aria-pressed="selected === entry.oid"
          :data-git-oid="entry.oid"
          @click="emit('select', entry.oid)"
        >
          <strong>{{ entry.message }}</strong>
          <small
            >{{ entry.author }} ·
            <time :datetime="entry.time">{{ new Date(entry.time).toLocaleString() }}</time></small
          >
          <code>{{ entry.oid.slice(0, 8) }}</code>
        </button>
      </li>
    </ol>
    <p v-else class="pe:text-sm pe:text-muted">{{ text.empty }}</p>
  </section>
</template>
