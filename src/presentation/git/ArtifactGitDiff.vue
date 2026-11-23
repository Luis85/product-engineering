<script setup lang="ts">
import UButton from "@nuxt/ui/components/Button.vue";
import { computed, ref, watch } from "vue";
import type { GitComparison } from "../../application/git";
import { useMessages } from "../shell";
import { diffPageSize, gitDiff } from "./diff";

const { comparison, revision } = defineProps<{
  readonly comparison: GitComparison;
  readonly revision: string | undefined;
}>();
const text = useMessages().git;
const diff = computed(() => gitDiff(comparison.base, comparison.current));
const page = ref(0);
watch(
  diff,
  () => {
    page.value = 0;
  },
  { flush: "sync" },
);
const pageCount = computed(() => diff.value.changedPages.length);
const pageLines = computed(() => {
  const start = (diff.value.changedPages[page.value] ?? 0) * diffPageSize;
  return diff.value.lines.slice(start, start + diffPageSize);
});
const path = computed(() => comparison.current?.path ?? comparison.base?.path);

const from = computed(() => {
  const { base, current, merge, parent } = comparison;
  const label = merge ? text.firstParent + " · " + parent?.slice(0, 8) : parent?.slice(0, 8);
  if (!base) return merge ? label + " · " + text.newFile : text.newFile;
  return base.path !== current?.path ? label + " · " + base.path : label;
});
const to = computed(() => revision?.slice(0, 8) ?? text.working);
const prefixes = { add: "+ ", remove: "- ", same: "  " };
</script>

<template>
  <p class="pe:wrap-anywhere pe:text-sm">{{ path }}</p>
  <p class="pe:wrap-anywhere pe:text-sm pe:text-muted">
    {{ from }} <span aria-hidden="true">→</span> {{ to }}
  </p>
  <p v-if="diff.identical" role="status">{{ text.noChanges }}</p>
  <template v-else>
    <nav v-if="pageCount > 1" class="pe-note-actions" :aria-label="text.diffPages">
      <UButton
        type="button"
        variant="soft"
        :disabled="page === 0"
        :label="text.previousChanges"
        data-testid="git-diff-previous"
        @click="page--"
      />
      <UButton
        type="button"
        variant="soft"
        :disabled="page + 1 >= pageCount"
        :label="text.nextChanges"
        data-testid="git-diff-next"
        @click="page++"
      />
      <span role="status">{{ text.diffPage(page + 1, pageCount) }}</span>
    </nav>
    <pre
      class="pe-git-diff"
      tabindex="0"
      :aria-label="text.diffLines"
    ><span v-for="(line, index) in pageLines" :key="index" :class="'pe-git-' + line.kind">{{ prefixes[line.kind] }}{{ line.text.replace(/\r?\n$/, '') }}</span></pre>
  </template>
</template>
