import type { NfrDraft, NfrId, NfrTarget } from "../../../domain/backlog";
import type { ProjectId } from "../../projects";
import { backlogAncestors, backlogDescendants } from "../contributions";
import type { BacklogItem } from "../model";

export type NfrMap = {
  readonly projectId: ProjectId;
  readonly id: string;
  readonly title: string;
  readonly displayId?: string;
  readonly links: readonly { readonly projectId: ProjectId; readonly itemId: string }[];
};
export type NfrScopeSource = NfrTarget | { readonly kind: "nfr"; readonly id: NfrId };
export type NfrOrigin = NfrScopeSource & {
  readonly title: string;
  readonly projectId: ProjectId;
  readonly displayId?: string;
};
export type NfrScopeRecord = NfrDraft & {
  readonly id: NfrId;
  readonly projectId: ProjectId;
  readonly targets: readonly NfrTarget[];
};
export type ScopedNfr = NfrDraft & { readonly id: NfrId; readonly sources: readonly NfrOrigin[] };

export const nfrTargetKey = (target: NfrScopeSource) => `${target.kind}:${target.id}`;

type StableItem = BacklogItem & { readonly id: string };

export function isNfrItem(item: BacklogItem): item is StableItem {
  return Boolean(item.adopted && !item.conflict && item.id);
}

export function nfrTargetOptions(
  projectId: ProjectId,
  items: readonly BacklogItem[],
  maps: readonly NfrMap[],
): readonly (NfrOrigin & NfrTarget)[] {
  return [
    ...items
      .filter(isNfrItem)
      .map(({ id, title }) => ({ kind: "item" as const, id, title, projectId })),
    ...maps
      .filter((map) => map.projectId === projectId)
      .map(({ id, title, displayId }) => ({
        kind: "map" as const,
        id,
        title,
        projectId,
        ...(displayId && { displayId }),
      })),
  ];
}

function linkedItems(project: ProjectId, map: NfrMap, items: readonly StableItem[]) {
  const ids = new Set(
    map.links.filter(({ projectId }) => projectId === project).map(({ itemId }) => itemId),
  );
  return items.filter(({ id }) => ids.has(id));
}

function itemOrigins(
  project: ProjectId,
  id: string,
  items: readonly BacklogItem[],
  maps: readonly NfrMap[],
) {
  const source = items.find((item) => item.id === id && isNfrItem(item));
  if (!source) return [];
  const parents = backlogAncestors(items, source);
  const children = backlogDescendants(items, source);
  const branch = [source, ...children];
  const parent = parents[0];
  if (parent?.kind === "UC") branch.push(parent);
  const linked = maps.filter((map) => linkedItems(project, map, branch.filter(isNfrItem)).length);
  return nfrTargetOptions(project, [source, ...parents, ...children], linked);
}

function mapOrigins(
  project: ProjectId,
  id: string,
  items: readonly BacklogItem[],
  maps: readonly NfrMap[],
) {
  const source = maps.find((map) => map.id === id);
  if (!source) return [];
  const origins = linkedItems(project, source, items.filter(isNfrItem)).flatMap((item) => [
    item,
    ...backlogAncestors(items, item),
    ...(item.kind === "UC" ? items.filter((entry) => entry.parent === item.key) : []),
  ]);
  return nfrTargetOptions(project, origins, [source]);
}

function scopedRecord(record: NfrScopeRecord, sources: readonly NfrOrigin[]): ScopedNfr {
  const { id, title, requirement, acceptance, categories, owner_id } = record;
  return {
    id,
    title,
    requirement,
    acceptance,
    ...(owner_id && { owner_id }),
    categories: [...new Set(categories)].toSorted(),
    sources: sources.toSorted((left, right) =>
      nfrTargetKey(left).localeCompare(nfrTargetKey(right)),
    ),
  };
}

export function nfrsForScope(
  project: ProjectId,
  source: NfrScopeSource,
  records: readonly NfrScopeRecord[],
  items: readonly BacklogItem[],
  suppliedMaps: readonly NfrMap[],
): readonly ScopedNfr[] {
  const scopedRecords = records.filter(({ projectId }) => projectId === project);
  if (source.kind === "nfr") {
    const record = scopedRecords.find(({ id }) => id === source.id);
    return record
      ? [scopedRecord(record, [{ ...source, projectId: project, title: record.title }])]
      : [];
  }
  const maps = suppliedMaps.filter(({ projectId }) => project === projectId);
  const applicable =
    source.kind === "item"
      ? itemOrigins(project, source.id, items, maps)
      : mapOrigins(project, source.id, items, maps);
  const origins = new Map(applicable.map((origin) => [nfrTargetKey(origin), origin]));
  const result = new Map<NfrId, ScopedNfr>();
  for (const record of scopedRecords) {
    const matches = new Set(
      record.targets.flatMap((target) => {
        const origin = origins.get(nfrTargetKey(target));
        return origin ? [origin] : [];
      }),
    );
    if (matches.size) result.set(record.id, scopedRecord(record, [...matches]));
  }
  return [...result.values()].toSorted((left, right) => left.id.localeCompare(right.id));
}
