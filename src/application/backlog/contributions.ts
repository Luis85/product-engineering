import { Effect } from "effect";
import type { DomainScopeContributor } from "../domain-model";
import type { GitArtifactSource } from "../git";
import type { ProjectId } from "../projects";
import type { BacklogItem } from "./model";
import { backlogSnapshot } from "./service";
import { pbiSourceDraft, resolvePbiSource } from "./pbi-sources";

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

export function backlogAncestors(items: readonly BacklogItem[], source: BacklogItem) {
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

export function backlogDescendants(items: readonly BacklogItem[], source: BacklogItem) {
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

export function backlogPrdOrigins(project: ProjectId, items: readonly BacklogItem[]) {
  return Effect.forEach(
    items,
    (item) => {
      const { pbi_prd_id, pbi_requirement_id } = pbiSourceDraft(item.fields);
      if (item.kind !== "UC" || !item.adopted || item.conflict || !pbi_requirement_id)
        return Effect.succeed(undefined);
      return resolvePbiSource(project, "prd", pbi_prd_id).pipe(
        Effect.map((record) =>
          record?.values.requirement_id === pbi_requirement_id
            ? { kind: "prd" as const, id: record.id, title: record.title, projectId: project }
            : undefined,
        ),
        Effect.catch(() => Effect.succeed(undefined)),
      );
    },
    { concurrency: 4 },
  );
}

export const backlogDomainContribution: DomainScopeContributor<
  | Effect.Services<ReturnType<typeof backlogSnapshot>>
  | Effect.Services<ReturnType<typeof backlogPrdOrigins>>
> = (project, target) =>
  Effect.gen(function* () {
    if (target.kind !== "item") return;
    const { items } = yield* backlogSnapshot(project);
    const source = items.find(
      ({ adopted, conflict, id }) => adopted && !conflict && id === target.id,
    );
    if (!source) return;
    const relatives = [...backlogAncestors(items, source), ...backlogDescendants(items, source)];
    const prds = (yield* backlogPrdOrigins(project, [source, ...relatives])).filter(
      (origin) => origin !== undefined,
    );
    return {
      source: { ...target, projectId: project, title: source.title },
      origins: [
        ...relatives.flatMap(({ id, title, adopted, conflict }) =>
          id && adopted && !conflict
            ? [{ kind: "item" as const, id, title, projectId: project }]
            : [],
        ),
        ...prds,
      ],
    };
  });
