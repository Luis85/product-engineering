import { reactive } from "vue";
import type { BacklogItem } from "../../application/backlog";
import type { ProjectId } from "../../application/projects";
import type { BacklogKind } from "../../domain/backlog";
import { useRouting } from "../shell";

export type BacklogFilters = {
  query: string;
  level: BacklogKind | "";
  status: string;
  priority: string;
};

type Preferences = BacklogFilters & { readonly collapsed: Set<string>; canUndo: boolean };
const byLeaf = new WeakMap<object, Map<ProjectId, Preferences>>();

export function resetBacklogFilters() {
  return { query: "", level: "", status: "", priority: "" } as const;
}

export function useBacklogPreferences(project: ProjectId) {
  const { navigation } = useRouting();
  const projects = byLeaf.get(navigation) ?? new Map<ProjectId, Preferences>();
  byLeaf.set(navigation, projects);
  const preferences =
    projects.get(project) ??
    reactive({ ...resetBacklogFilters(), collapsed: new Set<string>(), canUndo: false });
  projects.set(project, preferences);
  return preferences;
}

export type BacklogRow = {
  readonly item: BacklogItem;
  readonly depth: number;
  readonly context: boolean;
  readonly hasChildren: boolean;
  readonly expanded: boolean;
  readonly lineage?: string;
  readonly fixed?: boolean;
};

export function visibleBacklog(
  items: readonly BacklogItem[],
  preferences: Preferences,
): readonly BacklogRow[] {
  const query = preferences.query.trim().toLocaleLowerCase();
  const matching = new Set(
    items
      .filter(
        ({ key, kind, id, title, state, priority }) =>
          (!preferences.level || preferences.level === kind) &&
          (!preferences.status || preferences.status === state) &&
          (!preferences.priority || preferences.priority === priority) &&
          (!query || (title + " " + (id ?? key)).toLocaleLowerCase().includes(query)),
      )
      .map(({ key }) => key),
  );
  const byKey = new Map(items.map((item) => [item.key, item]));
  if (preferences.level) return focusedRows(items, byKey, matching);
  return visibleTree(items, byKey, matching, preferences);
}

function focusedRows(
  items: readonly BacklogItem[],
  byKey: ReadonlyMap<string, BacklogItem>,
  matching: ReadonlySet<string>,
) {
  return items
    .filter(({ key }) => matching.has(key))
    .map((item) => {
      const path: string[] = [];
      let current = item;
      while (current.parent) {
        const ancestor = byKey.get(current.parent);
        if (!ancestor) break;
        path.unshift(ancestor.title);
        current = ancestor;
      }
      return {
        item,
        depth: 0,
        context: false,
        expanded: false,
        hasChildren: false,
        lineage: path.join(" / "),
      };
    });
}

function groupChildren(items: readonly BacklogItem[]) {
  const children = new Map<string, BacklogItem[]>();
  for (const item of items) {
    const parent = item.parent ?? "";
    const group = children.get(parent);
    if (group) group.push(item);
    else children.set(parent, [item]);
  }
  return children;
}

function treeChildren(
  items: readonly BacklogItem[],
  byKey: ReadonlyMap<string, BacklogItem>,
  matching: ReadonlySet<string>,
) {
  const includes = new Set(matching);
  const ancestors = new Set<string>();
  for (const key of matching) {
    let parent = byKey.get(key)?.parent;
    while (parent && !ancestors.has(parent)) {
      ancestors.add(parent);
      includes.add(parent);
      parent = byKey.get(parent)?.parent;
    }
  }
  return groupChildren(items.filter(({ key }) => includes.has(key)));
}

function visibleTree(
  items: readonly BacklogItem[],
  byKey: ReadonlyMap<string, BacklogItem>,
  matching: ReadonlySet<string>,
  preferences: Preferences,
) {
  const children = treeChildren(items, byKey, matching);
  const filtering = Boolean(preferences.query.trim() || preferences.status || preferences.priority);
  const result: BacklogRow[] = [];
  function add(parent: string, depth: number) {
    for (const item of children.get(parent) ?? []) {
      const hasChildren = children.has(item.key);
      const expanded = hasChildren && (filtering || !preferences.collapsed.has(item.key));
      result.push({
        item,
        depth,
        context: !matching.has(item.key),
        hasChildren,
        expanded,
        fixed: filtering,
      });
      if (expanded) add(item.key, depth + 1);
    }
  }
  add("", 0);
  return result;
}
