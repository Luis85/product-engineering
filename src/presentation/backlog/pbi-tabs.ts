import { reactive, toRefs } from "vue";
import type { ProjectId } from "../../application/projects";
import { useRouting } from "../shell";

export const pbiTabs = ["usecase", "companions", "criteria", "links", "edit", "git"] as const;
export type PbiTab = (typeof pbiTabs)[number];
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
