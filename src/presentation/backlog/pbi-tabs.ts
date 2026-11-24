import { reactive, toRefs } from "vue";
import type { ProjectId } from "../../application/projects";
import type { PbiTab } from "../../application/backlog";
import { useRouting } from "../shell";

type Preferences = { tab: PbiTab; gaps: boolean | undefined };
const byLeaf = new WeakMap<object, Map<string, Preferences>>();

export function usePbiPreferences(project: ProjectId, id: string) {
  const { navigation } = useRouting();
  const tabs = byLeaf.get(navigation) ?? new Map<string, Preferences>();
  byLeaf.set(navigation, tabs);
  const key = project + "/" + id;
  const preferences = tabs.get(key) ?? reactive<Preferences>({ tab: "usecase", gaps: undefined });
  tabs.set(key, preferences);
  return toRefs(preferences);
}
