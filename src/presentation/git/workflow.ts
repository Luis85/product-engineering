import { computed, ref, shallowRef } from "vue";
import { commitArtifactGit, compareArtifactGit, inspectArtifactGit } from "../../application/git";
import type { ArtifactJournal, GitArtifactSource, GitComparison } from "../../application/git";
import { useCommand, useMessages, useQuery } from "../shell";

export function useArtifactGit(source: () => GitArtifactSource) {
  const text = useMessages().git;
  const inspect = useQuery(inspectArtifactGit);
  const compare = useQuery(compareArtifactGit);
  const write = useCommand(commitArtifactGit);
  const journal = shallowRef<ArtifactJournal>();
  const revision = ref<string>();
  const comparison = shallowRef<GitComparison>();
  const review = shallowRef<ArtifactJournal>();
  const commitError = shallowRef<{ readonly title: string; readonly conflict: boolean }>();
  const committing = ref(false);
  const announced = ref<string>();
  const selectedComparison = computed<GitComparison | undefined>(() => {
    if (revision.value) return comparison.value;
    const current = journal.value;
    return (
      current && {
        current: current.current,
        base: current.base,
        parent: current.head,
        merge: false,
      }
    );
  });
  const status = computed(() => {
    if (inspect.pending.value && !journal.value) return text.loading;
    if (inspect.error.value) return text.unavailable;
    const state = journal.value?.state;
    return state === "new"
      ? text.firstPending
      : state === "changed"
        ? text.pending
        : state === "clean"
          ? text.clean
          : text.unavailable;
  });
  const canCommit = computed(() =>
    Boolean(
      journal.value &&
      journal.value.state !== "clean" &&
      !inspect.pending.value &&
      !inspect.error.value,
    ),
  );

  async function refresh() {
    const result = await inspect.run(source());
    if (result._tag !== "success") return result;
    journal.value = result.value;
    const selected = revision.value;
    if (selected && !result.value.revisions.some(({ oid }) => oid === selected)) {
      revision.value = undefined;
      comparison.value = undefined;
    }
    return result;
  }

  async function select(oid?: string) {
    revision.value = oid;
    comparison.value = undefined;
    if (!oid) {
      await refresh();
      return;
    }
    const result = await compare.run(source(), oid);
    if (revision.value === oid && result._tag === "success") comparison.value = result.value;
  }

  function beginCommit() {
    if (!canCommit.value) return false;
    review.value = journal.value;
    commitError.value = undefined;
    announced.value = undefined;
    return true;
  }

  function cancelCommit() {
    review.value = undefined;
  }

  async function submitCommit(message: string) {
    if (!review.value || committing.value) return false;
    committing.value = true;
    try {
      commitError.value = undefined;
      const result = await write.run(source(), review.value, message);
      if (result._tag === "failure") {
        commitError.value = {
          title: result.message.title,
          conflict: result.error._tag === "ArtifactGitError" && result.error.reason === "conflict",
        };
        return false;
      }
      if (result._tag !== "success") return false;
      await refresh();
      await select(result.value);
      announced.value = result.value;
      cancelCommit();
      return true;
    } finally {
      committing.value = false;
    }
  }

  return {
    inspect,
    compare,
    journal,
    revision,
    selectedComparison,
    refresh,
    select,
    status,
    canCommit,
    review,
    commitError,
    committing,
    announced,
    beginCommit,
    cancelCommit,
    submitCommit,
  };
}

export type ArtifactGitWorkflow = ReturnType<typeof useArtifactGit>;
