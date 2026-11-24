import { Effect } from "effect";
import type { EntityScopeTarget } from "../../domain/knowledge";
import {
  backlogAncestors,
  backlogDescendants,
  backlogDomainContribution,
  backlogPrdOrigins,
  backlogSnapshot,
  pbiCompanions,
} from "../backlog";
import type { BacklogItem, NfrMapContributor } from "../backlog";
import { knowledgeNoteOptions, resolveKnowledgeNote } from "../knowledge";
import { NoteStore } from "../notes";
import { readFreshProject } from "../projects";
import type { ProjectId } from "../projects";
import { isCanonicalStoryItem, storyMapLinksTo } from "./links";
import { decodeStoryMap, storyMapsSnapshot } from "./records";
import type { StoryMapRecord } from "./records";

function scopedMaps(project: ProjectId) {
  return Effect.gen(function* () {
    if (!(yield* readFreshProject(project))) return [];
    const { maps } = yield* storyMapsSnapshot(project);
    const store = yield* NoteStore;
    const fresh = yield* Effect.forEach(
      maps,
      (map) =>
        store.readFresh(map.path).pipe(
          Effect.map(decodeStoryMap),
          Effect.catch(() => Effect.succeed(undefined)),
          Effect.map((current) =>
            current?.id === map.id && current.projectId === project ? current : undefined,
          ),
        ),
      { concurrency: 4 },
    );
    return fresh.filter((map) => map !== undefined);
  }).pipe(Effect.catch(() => Effect.succeed([])));
}

export const storyMapNfrContribution: NfrMapContributor<
  Effect.Services<ReturnType<typeof scopedMaps>>
> = (project) =>
  Effect.map(scopedMaps(project), (maps) =>
    maps.map((map) => ({
      projectId: project,
      id: map.id,
      displayId: map.displayId,
      title: map.title,
      links: map.cardLinks.flatMap((link) =>
        link.projectId === project && map.cards.some(({ id }) => id === link.cardId)
          ? [{ projectId: project, itemId: link.recordId }]
          : [],
      ),
    })),
  );

function mapOrigin(map: StoryMapRecord) {
  return { kind: "map" as const, id: map.id, title: map.title, projectId: map.projectId };
}

function referencePath(reference: string) {
  return /^!?\[\[([^#|\]]+)(?:[#|][^\]]*)?\]\]$/u
    .exec(reference)?.[1]
    ?.replace(/^\.\//, "")
    .replace(/\.md$/i, "");
}

function mapFoundations(map: StoryMapRecord) {
  return Effect.gen(function* () {
    const projectRecords = yield* knowledgeNoteOptions(map.projectId);
    const paths = new Set(map.references.map(referencePath).filter(Boolean));
    const candidates = projectRecords.filter(
      ({ id, kind, path }) =>
        (kind === "prd" && id === map.prdId) ||
        ((kind === "prd" || kind === "entity") && paths.has(path.replace(/\.md$/i, ""))),
    );
    const records = yield* Effect.forEach(
      candidates,
      ({ id, kind }) =>
        resolveKnowledgeNote(map.projectId, id).pipe(
          Effect.map((record) => (record?.kind === kind ? record : undefined)),
          Effect.catch(() => Effect.succeed(undefined)),
        ),
      { concurrency: 4 },
    );
    return {
      prds: records.flatMap((record) =>
        record?.kind === "prd"
          ? [{ kind: "prd" as const, id: record.id, title: record.title, projectId: map.projectId }]
          : [],
      ),
      foundationOrigins: records.flatMap((record) =>
        record?.kind === "entity" ? [{ entity: record.id, origin: mapOrigin(map) }] : [],
      ),
    };
  });
}

function linkedItems(map: StoryMapRecord, items: readonly BacklogItem[]) {
  return items.filter(isCanonicalStoryItem).filter(({ id }) => storyMapLinksTo(map, id).length > 0);
}

function mapDomainScope(map: StoryMapRecord, items: readonly BacklogItem[]) {
  return Effect.gen(function* () {
    const branch = linkedItems(map, items).flatMap((item) => [
      item,
      ...backlogAncestors(items, item),
      ...(item.kind === "UC" ? pbiCompanions(items, item).items : []),
    ]);
    const [foundations, prds] = yield* Effect.all([
      mapFoundations(map),
      backlogPrdOrigins(map.projectId, [...new Set(branch)]),
    ]);
    return {
      source: mapOrigin(map),
      origins: [
        ...branch
          .filter(isCanonicalStoryItem)
          .map(({ id, title }) => ({ kind: "item" as const, id, title, projectId: map.projectId })),
        ...prds.filter((origin) => origin !== undefined),
        ...foundations.prds,
      ],
      foundationOrigins: foundations.foundationOrigins,
    };
  });
}

function itemDomainScope(
  project: ProjectId,
  target: EntityScopeTarget,
  maps: readonly StoryMapRecord[],
  items: readonly BacklogItem[],
) {
  return Effect.gen(function* () {
    const current = yield* backlogDomainContribution(project, target);
    const item = items.find((row) => isCanonicalStoryItem(row) && row.id === target.id);
    if (!current || !item) return;
    const parent = backlogAncestors(items, item)[0];
    const branch = new Set(
      [item, ...backlogDescendants(items, item), ...(parent?.kind === "UC" ? [parent] : [])]
        .filter(isCanonicalStoryItem)
        .map(({ id }) => id),
    );
    const matches = maps.filter((map) =>
      [...branch].some((id) => storyMapLinksTo(map, id).length > 0),
    );
    const foundations = yield* Effect.forEach(matches, mapFoundations, { concurrency: 4 });
    return {
      ...current,
      origins: [
        ...(current.origins ?? []),
        ...matches.map(mapOrigin),
        ...foundations.flatMap(({ prds }) => prds),
      ],
      foundationOrigins: foundations.flatMap((scope) => scope.foundationOrigins),
    };
  });
}

export function storyMapDomainContribution(project: ProjectId, target: EntityScopeTarget) {
  return Effect.gen(function* () {
    if (target.kind === "prd") return;
    const [{ items }, maps] = yield* Effect.all([backlogSnapshot(project), scopedMaps(project)]);
    if (target.kind === "item") return yield* itemDomainScope(project, target, maps, items);
    const map = maps.find(({ id }) => id === target.id);
    if (map) return yield* mapDomainScope(map, items);
  });
}
