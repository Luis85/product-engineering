import { Effect } from "effect";
import { sameFrontmatterValue } from "../../domain/notes";
import { isStorySliceDeferral, isStorySliceHandoff } from "../../domain/story-maps";
import type { StoryMapCard, StorySliceCreation, StorySliceDeferral } from "../../domain/story-maps";
import { createBacklogItem } from "../backlog";
import type { BacklogCreateDraft, BacklogCreation, BacklogItem } from "../backlog";
import type { KnowledgeRecord } from "../knowledge";
import { StoryMapError } from "./errors";
import { storyMapCardsForCell } from "./journey";
import {
  isCanonicalStoryItem,
  readCanonicalStoryItem,
  sameStoryLink,
  storyMapLinkRows,
} from "./links";
import type { StoryMapRecord } from "./records";
import {
  hasPendingStoryCreation,
  inStorySlice,
  isStorySliceDeferred,
  pendingStoryCreationElsewhere,
  pendingStorySliceCreation,
  sameSliceCard,
  storySliceForRecovery,
} from "./slice-placement";
import type { StorySliceCard } from "./slice-placement";
import { freshStoryMap, withStoryMapWrite, writeStoryMap } from "./write";

export type StorySliceSources = {
  readonly prd: string;
  readonly requirement: string;
  readonly job: string;
};

function cardLinks(map: StoryMapRecord, cardId: string) {
  return map.cardLinks.filter((link) => link.cardId === cardId);
}

export function storySliceStories(
  map: StoryMapRecord,
  sliceId: string,
  items: readonly BacklogItem[],
) {
  const canonical = new Map(
    items
      .filter(isCanonicalStoryItem)
      .filter((item) => item.fields.project_id === map.projectId)
      .map((item) => [item.id, item]),
  );
  return map.activities.flatMap((activity) =>
    map.steps
      .filter(({ activityId }) => activityId === activity.id)
      .flatMap((step) =>
        storyMapCardsForCell(map, step.id, sliceId).map((card) => {
          const placement = { sliceId, cardId: card.id };
          const links = cardLinks(map, card.id).map((reference) => {
            const item =
              reference.projectId === map.projectId ? canonical.get(reference.recordId) : undefined;
            const created =
              item?.kind === "UC" &&
              map.sliceHandoffs.some(
                (row) =>
                  row.state === "created" &&
                  row.cardId === card.id &&
                  row.itemId === item.id &&
                  row.itemRecord === item.fields.id,
              );
            return { reference, item, created };
          });
          const covered = links.some(({ item }) => item?.kind === "UC");
          const deferred = !covered && isStorySliceDeferred(map, placement);
          const recoverySlice = storySliceForRecovery(map, placement);
          return { activity, step, card, links, covered, deferred, recoverySlice };
        }),
      ),
  );
}

export function storySliceSourceChoices(map: StoryMapRecord, records: readonly KnowledgeRecord[]) {
  const prd = records.find(
    (record) =>
      record.projectId === map.projectId &&
      record.kind === "prd" &&
      record.id === map.prdId &&
      record.values.requirement_id,
  );
  const jobs = map.jobIds.flatMap((id) => {
    const job = records.find(
      (record) => record.projectId === map.projectId && record.kind === "jtbd" && record.id === id,
    );
    return job ? [job] : [];
  });
  return {
    prd,
    jobs,
    sources: {
      prd: prd?.id ?? "",
      requirement: prd?.values.requirement_id ?? "",
      job: jobs[0]?.id ?? "",
    } satisfies StorySliceSources,
  };
}

export function storySliceFeature(
  map: StoryMapRecord,
  card: StoryMapCard,
  items: readonly BacklogItem[],
) {
  for (const link of cardLinks(map, card.id)) {
    if (link.projectId !== map.projectId) continue;
    const item = items.find(
      (candidate) =>
        candidate.id === link.recordId &&
        candidate.kind === "FE" &&
        candidate.fields.project_id === map.projectId &&
        isCanonicalStoryItem(candidate),
    );
    if (item) return item.key;
  }
  return "";
}

function storySliceHasCoverage(map: StoryMapRecord, cardId: string) {
  const candidates = cardLinks(map, cardId).filter(
    (ref) => ref.projectId === map.projectId && ref.recordId.startsWith("UC-"),
  );
  return Effect.gen(function* () {
    for (const { recordId } of candidates) {
      const resolved = yield* readCanonicalStoryItem(map.projectId, recordId);
      if (resolved?.item.kind === "UC") return true;
    }
    return false;
  });
}

function sourcesMatch(map: StoryMapRecord, sources: StorySliceSources) {
  return (
    (!sources.prd || sources.prd === map.prdId) &&
    (!sources.job || map.jobIds.some((id) => id === sources.job))
  );
}

function selectedRecord(map: StoryMapRecord, id: string, kind: "FE" | "EP") {
  return Effect.gen(function* () {
    if (!id) return "";
    const record = yield* readCanonicalStoryItem(map.projectId, id);
    if (record?.item.kind !== kind || typeof record.item.fields.id !== "string")
      return yield* new StoryMapError({ reason: "target" });
    return record.item.fields.id;
  });
}

function makeRecipe(
  map: StoryMapRecord,
  target: StorySliceCard,
  operation: BacklogCreation,
  draft: BacklogCreateDraft,
  sources: StorySliceSources,
) {
  return Effect.gen(function* () {
    const epic = draft.parent ? "" : (draft.epic ?? "");
    return {
      ...target,
      state: "pending",
      itemId: operation.item.id,
      itemRecord: operation.item.record,
      epicId: operation.epic.id,
      epicRecord: operation.epic.record,
      featureId: operation.feature.id,
      featureRecord: operation.feature.record,
      title: draft.title,
      body: draft.body,
      parent: draft.parent,
      parentRecord: yield* selectedRecord(map, draft.parent, "FE"),
      epic,
      selectedEpicRecord: yield* selectedRecord(map, epic, "EP"),
      epicTitle: draft.epicTitle ?? "",
      featureTitle: draft.featureTitle ?? "",
      priority: draft.priority,
      owner: draft.owner,
      ...sources,
    } satisfies StorySliceCreation;
  });
}

function sameCardLinks(before: StoryMapRecord, now: StoryMapRecord, cardId: string) {
  return sameFrontmatterValue(cardLinks(before, cardId), cardLinks(now, cardId));
}

function canCreate(map: StoryMapRecord, target: StorySliceCard, sources: StorySliceSources) {
  return (
    inStorySlice(map, target) &&
    !isStorySliceDeferred(map, target) &&
    !pendingStoryCreationElsewhere(map, target) &&
    sourcesMatch(map, sources)
  );
}

function samePlacement(base: StoryMapRecord, map: StoryMapRecord, target: StorySliceCard) {
  return (
    inStorySlice(map, target) &&
    map.cards.find(({ id }) => id === target.cardId)?.stepId ===
      base.cards.find(({ id }) => id === target.cardId)?.stepId
  );
}

export function setStorySliceDeferral(
  base: StoryMapRecord,
  target: StorySliceCard,
  deferred: boolean,
) {
  return withStoryMapWrite(
    Effect.gen(function* () {
      const current = yield* freshStoryMap(base);
      if (
        !samePlacement(base, current, target) ||
        hasPendingStoryCreation(current, target.cardId) ||
        (deferred && (yield* storySliceHasCoverage(current, target.cardId)))
      )
        return yield* new StoryMapError({ reason: "handoff" });
      if (isStorySliceDeferred(current, target) === deferred) return;
      const raw = current.frontmatter.slice_deferrals;
      const rows: readonly unknown[] = Array.isArray(raw) ? raw : [];
      const decision: StorySliceDeferral = { ...target, decision: "deferred" };
      yield* writeStoryMap(
        current,
        current,
        {
          slice_deferrals: deferred
            ? [...rows, decision]
            : rows.filter((row) => !isStorySliceDeferral(row) || !sameSliceCard(row, target)),
        },
        (actual) =>
          samePlacement(current, actual, target) &&
          !hasPendingStoryCreation(actual, target.cardId) &&
          sameCardLinks(current, actual, target.cardId),
      );
    }),
  );
}

function handoffRows(map: StoryMapRecord): readonly unknown[] {
  const rows = map.frontmatter.slice_handoffs;
  return Array.isArray(rows) ? rows : [];
}

function putHandoff(
  map: StoryMapRecord,
  value:
    | StorySliceCreation
    | {
        readonly state: "created";
        readonly sliceId: string;
        readonly cardId: string;
        readonly itemId: string;
        readonly itemRecord: string;
      },
) {
  const rows = handoffRows(map);
  const index = rows.findIndex(
    (row) =>
      isStorySliceHandoff(row) && sameSliceCard(row, value) && row.itemRecord === value.itemRecord,
  );
  const existing = rows[index];
  return isStorySliceHandoff(existing)
    ? rows.with(index, { ...existing, ...value })
    : [...rows, value];
}

function stageHandoff(map: StoryMapRecord, recipe: StorySliceCreation, pending: boolean) {
  return Effect.gen(function* () {
    const current = yield* freshStoryMap(map);
    if (
      !canCreate(current, recipe, recipe) ||
      !samePlacement(map, current, recipe) ||
      !sameCardLinks(map, current, recipe.cardId) ||
      !sameFrontmatterValue(
        pendingStorySliceCreation(current, recipe),
        pending ? recipe : undefined,
      ) ||
      (yield* selectedRecord(current, recipe.parent, "FE")) !== recipe.parentRecord ||
      (yield* selectedRecord(current, recipe.epic, "EP")) !== recipe.selectedEpicRecord
    )
      return yield* new StoryMapError({ reason: "handoff" });
    if (pending) return;
    yield* writeStoryMap(
      current,
      current,
      { slice_handoffs: putHandoff(current, recipe) },
      (actual) =>
        canCreate(actual, recipe, recipe) &&
        samePlacement(current, actual, recipe) &&
        !pendingStorySliceCreation(actual, recipe) &&
        sameCardLinks(current, actual, recipe.cardId),
    );
  });
}

function attachHandoff(map: StoryMapRecord, recipe: StorySliceCreation) {
  return Effect.gen(function* () {
    const current = yield* freshStoryMap(map);
    const { cardId, itemId, itemRecord, sliceId } = recipe;
    const link = { projectId: current.projectId, kind: "item" as const, cardId, recordId: itemId };
    const rows = storyMapLinkRows(current);
    if (!sameFrontmatterValue(pendingStorySliceCreation(current, recipe), recipe))
      return yield* new StoryMapError({ reason: "handoff" });
    yield* writeStoryMap(
      current,
      current,
      {
        card_links: rows.some((row) => sameStoryLink(row, link)) ? rows : [...rows, link],
        slice_handoffs: putHandoff(current, {
          state: "created",
          cardId,
          itemId,
          itemRecord,
          sliceId,
        }),
      },
      (actual) =>
        canCreate(actual, recipe, recipe) &&
        samePlacement(map, actual, recipe) &&
        sameCardLinks(map, actual, cardId),
    );
  });
}

function finishedStoryPbi(map: StoryMapRecord, target: StorySliceCard, record: string) {
  return Effect.gen(function* () {
    const handoff = map.sliceHandoffs.find(
      (row) => row.state === "created" && sameSliceCard(row, target) && row.itemRecord === record,
    );
    if (!handoff) return;
    const saved = yield* readCanonicalStoryItem(map.projectId, handoff.itemId);
    const linked = cardLinks(map, target.cardId).some(
      (ref) => ref.projectId === map.projectId && ref.recordId === handoff.itemId,
    );
    if (saved?.item.kind !== "UC" || saved.item.fields.id !== handoff.itemRecord || !linked)
      return yield* new StoryMapError({ reason: "handoff" });
    return saved.item;
  });
}

export function createStorySlicePbi(
  base: StoryMapRecord,
  target: StorySliceCard,
  operation: BacklogCreation,
  draft: BacklogCreateDraft,
  sources: StorySliceSources,
) {
  return withStoryMapWrite(
    Effect.gen(function* () {
      const map = yield* freshStoryMap(base);
      if (
        !canCreate(map, target, sources) ||
        !samePlacement(base, map, target) ||
        base.prdId !== map.prdId
      )
        return yield* new StoryMapError({ reason: "handoff" });
      const finished = yield* finishedStoryPbi(map, target, operation.item.record);
      if (finished) return finished;
      if (yield* storySliceHasCoverage(map, target.cardId))
        return yield* new StoryMapError({ reason: "handoff" });
      const pending = pendingStorySliceCreation(map, target);
      const recipe = pending ?? (yield* makeRecipe(map, target, operation, draft, sources));
      const item = yield* createBacklogItem(
        map.projectId,
        {
          epic: { id: recipe.epicId, record: recipe.epicRecord },
          feature: { id: recipe.featureId, record: recipe.featureRecord },
          item: { id: recipe.itemId, record: recipe.itemRecord },
        },
        {
          ...recipe,
          kind: "UC",
          state: "",
          sources: {
            pbi_prd_id: recipe.prd,
            pbi_requirement_id: recipe.requirement,
            pbi_job_id: recipe.job,
          },
        },
        stageHandoff(map, recipe, Boolean(pending)),
      );
      if (item.kind !== "UC" || item.fields.id !== recipe.itemRecord)
        return yield* new StoryMapError({ reason: "handoff" });
      yield* attachHandoff(map, recipe);
      return item;
    }),
  );
}
