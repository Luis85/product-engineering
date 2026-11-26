import { Effect } from "effect";
import type { StoryMapCardLink } from "../../domain/story-maps";
import { readBacklogItem } from "../backlog";
import type { BacklogItem } from "../backlog";
import type { ProjectId } from "../projects";
import { StoryMapError } from "./errors";
import type { StoryMapRecord } from "./records";
import { hasPendingStoryCreation, inStorySlice, isStorySliceDeferred } from "./slice-placement";
import { freshStoryMap, withStoryMapWrite, writeStoryMap } from "./write";

export function isCanonicalStoryItem(
  item: BacklogItem,
): item is BacklogItem & { readonly id: string } {
  return Boolean(item.id && item.adopted && !item.conflict);
}

export function storyMapLinksTo(map: StoryMapRecord, recordId: string) {
  return map.cardLinks.filter(
    (ref) =>
      ref.projectId === map.projectId &&
      ref.recordId === recordId &&
      map.cards.some(({ id }) => id === ref.cardId),
  );
}

export function storyMapItemBacklinks(
  projectId: ProjectId,
  itemId: string,
  maps: readonly StoryMapRecord[],
) {
  return maps
    .filter((map) => map.projectId === projectId)
    .flatMap((map) => {
      const cards = new Set(storyMapLinksTo(map, itemId).map(({ cardId }) => cardId));
      return map.cards.filter(({ id }) => cards.has(id)).map((card) => ({ map, card }));
    });
}

function cardExists(map: StoryMapRecord, cardId: string) {
  return map.cards.some(({ id }) => id === cardId);
}

export function sameStoryLink(row: unknown, link: StoryMapCardLink) {
  return (
    typeof row === "object" &&
    row !== null &&
    "kind" in row &&
    row.kind === link.kind &&
    "projectId" in row &&
    row.projectId === link.projectId &&
    "cardId" in row &&
    row.cardId === link.cardId &&
    "recordId" in row &&
    row.recordId === link.recordId
  );
}

export function readCanonicalStoryItem(project: ProjectId, id: string) {
  return readBacklogItem(project, id).pipe(
    Effect.catch(() => Effect.succeed(undefined)),
    Effect.map((record) =>
      record && isCanonicalStoryItem(record.item) && record.item.id === id ? record : undefined,
    ),
  );
}

export function storyMapLinkRows(map: StoryMapRecord) {
  const rows = map.frontmatter.card_links;
  return Array.isArray(rows) ? (rows as readonly unknown[]) : [];
}

function canChangeLink(map: StoryMapRecord, cardId: string, linked: boolean, sliceId?: string) {
  if (linked && hasPendingStoryCreation(map, cardId)) return false;
  if (sliceId === undefined) return cardExists(map, cardId);
  const target = { cardId, sliceId };
  return inStorySlice(map, target) && (!linked || !isStorySliceDeferred(map, target));
}

export function setStoryMapItemLink(
  base: StoryMapRecord,
  link: StoryMapCardLink,
  linked: boolean,
  sliceId?: string,
) {
  return withStoryMapWrite(
    Effect.gen(function* () {
      const current = yield* freshStoryMap(base);
      if (link.projectId !== current.projectId && linked)
        return yield* new StoryMapError({ reason: "target" });
      if (!canChangeLink(current, link.cardId, linked, sliceId))
        return yield* new StoryMapError({ reason: sliceId ? "handoff" : "target" });
      if (linked && !(yield* readCanonicalStoryItem(current.projectId, link.recordId)))
        return yield* new StoryMapError({ reason: "target" });
      const rows = storyMapLinkRows(current);
      const exists = rows.some((row) => sameStoryLink(row, link));
      if (exists === linked) return;
      yield* writeStoryMap(
        current,
        current,
        {
          card_links: linked ? [...rows, link] : rows.filter((row) => !sameStoryLink(row, link)),
        },
        (actual) => canChangeLink(actual, link.cardId, linked, sliceId),
      );
    }),
  );
}
