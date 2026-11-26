<script setup lang="ts">
import UButton from "@nuxt/ui/components/Button.vue";
import { computed } from "vue";
import { useMessages } from "../shell";
import ArtifactGitDiff from "./ArtifactGitDiff.vue";
import ArtifactGitVersions from "./ArtifactGitVersions.vue";
import type { ArtifactGitWorkflow } from "./workflow";

const { git } = defineProps<{ readonly git: ArtifactGitWorkflow }>();
const text = useMessages().git;
const { journal, selectedComparison, revision, compare, inspect, select, refresh } = git;
const operation = computed(() => (revision.value ? compare : inspect));
const loading = computed(() => operation.value.pending.value);
const error = computed(() => operation.value.message.value?.title);
function retry() {
  return revision.value ? select(revision.value) : refresh();
}
</script>

<template>
  <div class="pe:@container pe:min-w-0">
    <div class="pe-git-history">
      <ArtifactGitVersions
        v-if="journal"
        :entries="journal.revisions"
        :selected="revision"
        @select="select"
      />
      <section
        class="pe:min-w-0"
        :aria-label="text.comparison"
        :data-git-parent="selectedComparison?.parent"
        data-testid="git-comparison"
      >
        <p v-if="loading" role="status">{{ text.loading }}</p>
        <template v-else-if="error">
          <p role="alert">{{ error }}</p>
          <UButton type="button" variant="soft" :label="text.retry" @click="retry" />
        </template>
        <ArtifactGitDiff
          v-else-if="selectedComparison"
          :comparison="selectedComparison"
          :revision="revision"
        />
      </section>
    </div>
  </div>
</template>
