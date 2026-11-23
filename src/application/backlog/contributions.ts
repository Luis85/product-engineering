import { Effect } from "effect";
import type { DomainScopeContributor } from "../domain-model";
import type { GitArtifactSource } from "../git";
import type { ProjectId } from "../projects";
import type { BacklogItem } from "./model";
import { backlogSnapshot } from "./service";

export function resolveBacklogItem(project: ProjectId, id: string) {
  return Effect.map(backlogSnapshot(project), ({ items }) =>
    items.find((item) => !item.conflict && (item.key === id || item.path === id)),
  );
}

export function backlogGitSource(projectId: ProjectId, key: string): GitArtifactSource {
  return {
    projectId,
    resolvePath: Effect.map(resolveBacklogItem(projectId, key), (item) => item?.path),
  };
}

function ancestors(items: readonly BacklogItem[], source: BacklogItem) {
  const byKey = new Map(items.map((item) => [item.key, item]));
  const visited = new Set([source.key]);
  const result: BacklogItem[] = [];
  let current = source;
  while (current.parent && !visited.has(current.parent)) {
    const parent = byKey.get(current.parent);
    if (!parent) break;
    visited.add(parent.key);
    result.push(parent);
    current = parent;
  }
  return result;
}

function descendants(items: readonly BacklogItem[], source: BacklogItem) {
  const visited = new Set([source.key]);
  const result: BacklogItem[] = [];
  let roots = [source.key];
  while (roots.length) {
    const batch = items.filter(
      ({ key, parent }) => parent && roots.includes(parent) && !visited.has(key),
    );
    roots = batch.map(({ key }) => key);
    for (const row of batch) {
      visited.add(row.key);
      result.push(row);
    }
  }
  return result;
}

export const backlogDomainContribution: DomainScopeContributor<
  Effect.Services<ReturnType<typeof backlogSnapshot>>
> = (project, target) =>
  Effect.map(backlogSnapshot(project), ({ items }) => {
    if (target.kind !== "item") return;
    const source = items.find(
      ({ adopted, conflict, id }) => adopted && !conflict && id === target.id,
    );
    if (!source) return;
    const relatives = [...ancestors(items, source), ...descendants(items, source)];
    return {
      source: { ...target, projectId: project, title: source.title },
      origins: relatives.flatMap(({ id, title, adopted, conflict }) =>
        id && adopted && !conflict ? [{ kind: "item", id, title, projectId: project }] : [],
      ),
    };
  });
