<script setup lang="ts">
import { backlogGitSource } from "../../application/backlog";
import type { ProjectId } from "../../application/projects";
import { ArtifactGitActions, ArtifactGitCommit, ArtifactGitHistory, useArtifactGit } from "../git";
import { useNavigationGuard } from "../shell";

const { projectId, pbiId } = defineProps<{
  readonly projectId: ProjectId;
  readonly pbiId: string;
}>();
const emit = defineEmits<{ committed: [] }>();
const git = useArtifactGit(() => backlogGitSource(projectId, pbiId));
let trigger: HTMLElement | undefined;

function commit(event: Event) {
  trigger = event.currentTarget as HTMLElement;
  git.beginCommit();
}

useNavigationGuard(() => !git.committing.value);
void git.refresh();
</script>

<template>
  <section class="pe:grid pe:min-w-0 pe:gap-3">
    <ArtifactGitActions
      :git="git"
      :dirty="false"
      :saving="false"
      editable
      history
      @commit="commit"
    />
    <ArtifactGitHistory :git="git" />
    <ArtifactGitCommit
      :git="git"
      local-escape
      :restore-focus="() => trigger?.focus({ preventScroll: true })"
      @committed="emit('committed')"
      @review="git.refresh"
    />
  </section>
</template>
