import { Effect } from "effect";
import { mappedBoardStage, validBacklogTitle } from "../../domain/backlog";
import { sameFrontmatterValue } from "../../domain/notes";
import { isStoryMapWork } from "../../domain/story-maps";
import type { StoryMapCardLink, StoryMapWork } from "../../domain/story-maps";
import { createBacklogItem, pbiCompanions, resolveBacklogItem } from "../backlog";
import type { BacklogCreation, BacklogItem } from "../backlog";
import { projectMemberChoices } from "../projects";
import type { BacklogBase } from "../projects";
import { StoryMapError } from "./errors";
import { replaceStoryMapRow } from "./journey";
import {
  isCanonicalStoryItem,
  readCanonicalStoryItem,
  sameStoryLink,
  storyMapLinkRows,
} from "./links";
import { decodeStoryMap } from "./records";
import type { StoryMapRecord } from "./records";
import { freshStoryMap, withStoryMapWrite, writeStoryMap } from "./write";

export function storyMapWorkScope(
  map: StoryMapRecord,
  cardId: string,
  items: readonly BacklogItem[],
) {
  const ids = new Set(
    map.cardLinks
      .filter((link) => link.projectId === map.projectId && link.cardId === cardId)
      .map(({ recordId }) => recordId),
  );
  const linked = items.filter(isCanonicalStoryItem).filter(({ id }) => ids.has(id));
  const parents = linked.filter(({ kind }) => kind === "UC");
  const attached = linked.filter(({ kind }) => kind !== "UC" && kind !== "EP" && kind !== "FE");
  const owned = map.work.filter((work) => work.cardId === cardId);
  const related = parents
    .flatMap((parent) => pbiCompanions(items, parent).items)
    .filter(({ id }) => !ids.has(id ?? "") && !owned.some((work) => work.id === id));
  return { parents, attached, owned, related };
}

function linkedPbi(map: StoryMapRecord, cardId: string, itemId: string) {
  return map.cardLinks.some(
    (link) =>
      link.projectId === map.projectId && link.cardId === cardId && link.recordId === itemId,
  );
}

function validateWork(map: StoryMapRecord, input: StoryMapWork, before: StoryMapWork | undefined) {
  return Effect.gen(function* () {
    if (
      !isStoryMapWork(input) ||
      !input.id.startsWith(input.kind + "-") ||
      !validBacklogTitle(input.title) ||
      !map.cards.some(({ id }) => id === input.cardId)
    )
      return yield* new StoryMapError({ reason: "work" });
    if (input.owner && input.owner !== before?.owner) {
      const members = yield* projectMemberChoices(map.projectId);
      if (!members?.some(({ id }) => id === input.owner))
        return yield* new StoryMapError({ reason: "work" });
    }
  });
}

function stageWork(current: StoryMapRecord, work: StoryMapWork, parent: string) {
  return Effect.gen(function* () {
    const staged = yield* writeStoryMap(
      current,
      current,
      {
        story_work: replaceStoryMapRow(current, "story_work", work),
      },
      (actual) =>
        actual.cards.some(({ id }) => id === work.cardId) &&
        (parent === "story" || linkedPbi(actual, work.cardId, parent)),
    );
    const updated = decodeStoryMap(staged);
    if (!updated) return yield* new StoryMapError({ reason: "identity" });
    return updated;
  });
}

function acceptsWork(base: BacklogBase, work: StoryMapWork) {
  const { state, priority } = work;
  const validState =
    !state || base.states.includes(state) || state === mappedBoardStage("Open", base.states);
  return validState && (!priority || base.priorities.includes(priority));
}

function hasWorkIdentity(item: BacklogItem | undefined, work: StoryMapWork, parent: string) {
  return item?.parent === parent && item.fields.id === work.recordId;
}

function finishAssignment(
  staged: StoryMapRecord,
  work: StoryMapWork,
  link: StoryMapCardLink,
  parent: string,
) {
  const storedWork = staged.frontmatter.story_work;
  const rows = storyMapLinkRows(staged);
  return writeStoryMap(
    staged,
    staged,
    {
      story_work: Array.isArray(storedWork)
        ? storedWork.filter((row: unknown) => !isStoryMapWork(row) || row.id !== work.id)
        : [],
      card_links: rows.some((row) => sameStoryLink(row, link)) ? rows : [...rows, link],
    },
    (actual) =>
      linkedPbi(actual, work.cardId, parent) && actual.cards.some(({ id }) => id === work.cardId),
  );
}

function assignWork(
  current: StoryMapRecord,
  work: StoryMapWork,
  parent: string,
  creation: BacklogCreation,
) {
  return Effect.gen(function* () {
    const target = yield* readCanonicalStoryItem(current.projectId, parent);
    if (
      target?.item.kind !== "UC" ||
      !linkedPbi(current, work.cardId, parent) ||
      !acceptsWork(target.base, work)
    )
      return yield* new StoryMapError({ reason: "work" });
    const link = {
      cardId: work.cardId,
      recordId: work.id,
      kind: "item" as const,
      projectId: current.projectId,
    };
    const linked = storyMapLinkRows(current).some((row) => sameStoryLink(row, link));
    if (linked && !current.work.some(({ id }) => id === work.id)) {
      const prior = yield* readCanonicalStoryItem(current.projectId, work.id);
      if (hasWorkIdentity(prior?.item, work, parent)) return;
      return yield* new StoryMapError({ reason: "work" });
    }
    const staged = yield* stageWork(current, work, parent);
    const created = yield* createBacklogItem(
      current.projectId,
      { ...creation, item: { id: work.id, record: work.recordId } },
      {
        title: work.title,
        body: work.body,
        kind: work.kind,
        state: work.state,
        priority: work.priority,
        owner: work.owner,
        parent,
        preserveBlankState: true,
      },
    );
    if (!hasWorkIdentity(created, work, parent))
      return yield* new StoryMapError({ reason: "work" });
    yield* finishAssignment(staged, work, link, parent);
  });
}

function conflictingWork(
  existing: StoryMapWork | undefined,
  before: StoryMapWork | undefined,
  work: StoryMapWork,
) {
  return (
    existing &&
    (existing.cardId !== work.cardId ||
      existing.recordId !== work.recordId ||
      (!sameFrontmatterValue(existing, before) && !sameFrontmatterValue(existing, work)))
  );
}

export function saveStoryMapWork(
  base: StoryMapRecord,
  input: StoryMapWork,
  destination: string,
  creation: BacklogCreation,
) {
  return withStoryMapWrite(
    Effect.gen(function* () {
      const current = yield* freshStoryMap(base);
      const before = base.work.find(({ id }) => id === input.id);
      const existing = current.work.find(({ id }) => id === input.id);
      const work = { ...input, title: input.title.trim() };
      if (before && !existing && !linkedPbi(current, work.cardId, work.id))
        return yield* new StoryMapError({ reason: "work" });
      if (conflictingWork(existing, before, work))
        return yield* new StoryMapError({ reason: "work" });
      yield* validateWork(current, work, existing);
      if (destination !== "story") return yield* assignWork(current, work, destination, creation);
      if (yield* resolveBacklogItem(current.projectId, work.id))
        return yield* new StoryMapError({ reason: "work" });
      yield* stageWork(current, work, destination);
    }),
  );
}
