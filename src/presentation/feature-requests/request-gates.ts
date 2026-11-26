import { computed, watch } from "vue";
import { readDraftRequestGates, requestGateProgress } from "../../application/feature-requests";
import type { FeatureRequest } from "../../application/feature-requests";
import { useMessages, useQuery } from "../shell";

export function useRequestGates(record: () => FeatureRequest, inputs: () => unknown) {
  const text = useMessages()["feature-requests"];
  const read = useQuery(readDraftRequestGates);
  const live = computed(() => record().state === "draft");
  watch(
    [record, inputs],
    ([current]) => {
      if (live.value) void read.run(current);
    },
    { immediate: true },
  );
  const phase = computed(() => (live.value ? "ready" : "done"));
  const current = computed(() => (live.value ? read.value.value : undefined));
  const evidence = computed(() => ({
    ready: live.value ? current.value?.ready : record().readyGates,
    done: live.value ? current.value?.done : record().doneGates,
  }));
  function progress(gates: (typeof evidence.value)["ready"]) {
    const counts = requestGateProgress(gates);
    return counts ? text.gateCount(counts.met, counts.total) : text.gatesUnavailable;
  }
  const label = computed(() => {
    const count =
      live.value && read.pending.value
        ? text.loadingGates
        : progress(
            current.value?.rulesAvailable === false ? undefined : evidence.value[phase.value],
          );
    return `${text.gatePhases[phase.value]} · ${count}`;
  });
  return { label, evidence, current, progress, pending: read.pending, error: read.message };
}
