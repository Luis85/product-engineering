import { reactive, toRefs } from "vue";
import type { FeatureRequest } from "../../application/feature-requests";
import { useRouting } from "../shell";

export type RequestDetailTab = "package" | "gates" | "run" | "evidence";
type DetailState = {
  tab: RequestDetailTab;
  historicalRevision: number | undefined;
  disclosures: Set<string>;
};
const byLeaf = new WeakMap<object, Map<string, DetailState>>();

export function useRequestDetailState(record: Pick<FeatureRequest, "projectId" | "id">) {
  const { navigation } = useRouting();
  const state = byLeaf.get(navigation) ?? new Map<string, DetailState>();
  byLeaf.set(navigation, state);
  const key = `${record.projectId}/${record.id}`;
  const preferences =
    state.get(key) ??
    reactive<DetailState>({
      tab: "package",
      historicalRevision: undefined,
      disclosures: new Set(),
    });
  state.set(key, preferences);
  return toRefs(preferences);
}
