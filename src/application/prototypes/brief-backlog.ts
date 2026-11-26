import { Effect } from "effect";
import type { KnowledgeId } from "../../domain/knowledge";
import type { PrototypeSource } from "../../domain/prototypes";
import {
  backlogAncestors,
  backlogDescendants,
  pbiCompanions,
  readBacklogItem,
  readPbiDetail,
} from "../backlog";
import type { BacklogItem, PbiDetail } from "../backlog";
import type { ProjectId } from "../projects";
import { isCanonicalStoryItem } from "../story-maps";
import type { StoryMapRecord } from "../story-maps";

export type BriefDocumentReference = {
  readonly id: string;
  readonly kind: string;
  readonly origin: string;
};

export type BriefFileReference = {
  readonly reference: string;
  readonly sourcePath: string;
  readonly origin: string;
};

function mapBacklogIds(project: ProjectId, map: StoryMapRecord) {
  const cards = new Set(map.cards.map(({ id }) => id));
  return unique(
    map.cardLinks.flatMap(({ cardId, projectId, recordId }) =>
      projectId === project && cards.has(cardId) ? [recordId] : [],
    ),
  );
}

export function unique<A>(entries: Iterable<A>) {
  return [...new Set(entries)];
}

function relatedIds(
  project: ProjectId,
  source: PrototypeSource,
  map: StoryMapRecord | undefined,
  items: readonly BacklogItem[],
) {
  const canonical = items.filter(isCanonicalStoryItem);
  const parentIds = (item: BacklogItem) =>
    backlogAncestors(canonical, item)
      .filter(isCanonicalStoryItem)
      .map(({ id }) => id);
  if (map) {
    const linked = mapBacklogIds(project, map);
    return unique(
      linked.flatMap((id) => {
        const item = canonical.find((entry) => entry.id === id);
        if (!item) return [id];
        const work = item.kind === "UC" ? pbiCompanions(canonical, item).items : [];
        return [
          id,
          ...parentIds(item),
          ...work.filter(isCanonicalStoryItem).map((entry) => entry.id),
        ];
      }),
    );
  }
  if (source.kind === "map" || source.kind === "nfr") return [];
  const item = canonical.find(({ id, kind }) => id === source.id && kind === source.kind);
  return item
    ? unique([
        item.id,
        ...parentIds(item),
        ...backlogDescendants(canonical, item)
          .filter(isCanonicalStoryItem)
          .map(({ id }) => id),
      ])
    : [source.id];
}

function available<A, E, R>(effect: Effect.Effect<A, E, R>) {
  return Effect.catch(effect, () => Effect.succeed(undefined));
}

function pbiMaterial(detail: PbiDetail | undefined) {
  if (!detail) return { sources: [], criteria: [], references: [], requirement: undefined };
  return {
    sources: detail.sources.flatMap(({ id, kind }) => (id ? [{ id, kind }] : [])),
    criteria: detail.criteria ?? [],
    references: detail.references,
    requirement: detail.edit.item.fields.pbi_requirement_id,
  };
}

function readBacklogMaterial(project: ProjectId, id: string, kind: BacklogItem["kind"]) {
  return Effect.gen(function* () {
    const detail = kind === "UC" ? yield* available(readPbiDetail(project, id)) : undefined;
    const edit = detail?.edit ?? (yield* available(readBacklogItem(project, id)));
    if (!edit || edit.item.id !== id || !isCanonicalStoryItem(edit.item))
      return { id, missing: true } as const;
    const { item, draft } = edit;
    return {
      id,
      kind: item.kind,
      title: item.title,
      parent: item.parent,
      body: draft.body,
      path: item.path,
      ...pbiMaterial(detail),
    };
  });
}

export function briefBacklog(
  project: ProjectId,
  source: PrototypeSource,
  map: StoryMapRecord | undefined,
  items: readonly BacklogItem[],
) {
  return Effect.forEach(
    relatedIds(project, source, map, items),
    (id) => {
      const current = items.find((row) => row.id === id && isCanonicalStoryItem(row));
      return current
        ? readBacklogMaterial(project, id, current.kind)
        : Effect.succeed({ id, missing: true } as const);
    },
    { concurrency: 4 },
  );
}

export type BriefBacklog = Effect.Success<ReturnType<typeof briefBacklog>>;

export function briefDocumentReferences(map: StoryMapRecord | undefined, items: BriefBacklog) {
  const references: BriefDocumentReference[] = items.flatMap((item) =>
    item.missing ? [] : item.sources.map((source) => ({ ...source, origin: item.id })),
  );
  if (map) {
    const add = (id: KnowledgeId, kind: string) =>
      references.push({ id, kind, origin: map.displayId });
    if (map.prdId) add(map.prdId, "prd");
    for (const id of map.jobIds) add(id, "jtbd");
  }
  return references;
}

export function briefFileReferences(map: StoryMapRecord | undefined, items: BriefBacklog) {
  return [
    ...(map?.references.map((reference) => ({
      reference,
      sourcePath: map.path,
      origin: map.displayId,
    })) ?? []),
    ...items.flatMap((item) =>
      item.missing
        ? []
        : item.references.map((reference) => ({
            reference,
            sourcePath: item.path,
            origin: item.id,
          })),
    ),
  ] satisfies BriefFileReference[];
}
