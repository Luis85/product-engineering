import { Effect } from "effect";
import { validBacklogTitle } from "../../domain/backlog";
import { storyMapFieldInvalid, storyMapFields } from "../../domain/story-maps";
import type {
  StoryMapActivity,
  StoryMapCard,
  StoryMapDraft,
  StoryMapSlice,
  StoryMapStep,
} from "../../domain/story-maps";
import { IdGenerator } from "../notes";
import { StoryMapError } from "./errors";
import type { StoryMapRecord } from "./records";
import { freshStoryMap, withStoryMapWrite, writeStoryMap } from "./write";

export type StoryMapNodeEdit =
  | { readonly kind: "activity"; readonly node: StoryMapActivity }
  | { readonly kind: "step"; readonly node: StoryMapStep }
  | { readonly kind: "slice"; readonly node: StoryMapSlice }
  | { readonly kind: "card"; readonly node: StoryMapCard };

const fieldFor = { activity: "activities", step: "steps", slice: "slices", card: "cards" } as const;
export const newStoryMapNodeId = IdGenerator.use(({ nextId }) => nextId);

export function storyMapNodeToEdit(map: StoryMapRecord, input: StoryMapNodeEdit) {
  const { id } = input.node;
  if (!id) return input;
  const matching = <A extends { readonly id: string }>(rows: readonly A[]) =>
    rows.find((row) => row.id === id);
  switch (input.kind) {
    case "activity": {
      const node = matching(map.activities);
      return node && { kind: input.kind, node };
    }
    case "step": {
      const node = matching(map.steps);
      return node && { kind: input.kind, node };
    }
    case "slice": {
      const node = matching(map.slices);
      return node && { kind: input.kind, node };
    }
    case "card": {
      const node = matching(map.cards);
      return node && { kind: input.kind, node };
    }
  }
}

function rawRows(map: StoryMapRecord, field: string): readonly unknown[] {
  const raw = map.frontmatter[field];
  return Array.isArray(raw) ? raw : [];
}

function withNodeId(row: unknown, id: string): row is Record<string, unknown> {
  return typeof row === "object" && row !== null && "id" in row && row.id === id;
}

export function replaceStoryMapRow(
  map: StoryMapRecord,
  field: string,
  node: { readonly id: string },
  optional: readonly string[] = [],
) {
  const rows = rawRows(map, field);
  const index = rows.findIndex((raw) => withNodeId(raw, node.id));
  const updated: Record<string, unknown> = {
    ...(index < 0 ? {} : (rows[index] as Record<string, unknown>)),
    ...node,
  };
  for (const key of optional) if (updated[key] === undefined) delete updated[key];
  return index < 0 ? [...rows, updated] : rows.with(index, updated);
}

function destinationsAreValid(map: StoryMapRecord, edit: StoryMapNodeEdit) {
  if (edit.kind === "step") return map.activities.some(({ id }) => id === edit.node.activityId);
  if (edit.kind === "card")
    return (
      map.steps.some(({ id }) => id === edit.node.stepId) &&
      (!edit.node.sliceId || map.slices.some(({ id }) => id === edit.node.sliceId))
    );
  return true;
}

function cleanNode(edit: StoryMapNodeEdit) {
  const title = edit.node.title.trim();
  if (edit.kind === "slice")
    return { ...edit.node, title, outcome: edit.node.outcome?.trim() || undefined };
  if (edit.kind === "card")
    return {
      ...edit.node,
      title,
      description: edit.node.description?.trim() || undefined,
      sliceId: edit.node.sliceId || undefined,
    };
  return { ...edit.node, title };
}

function validNode(edit: StoryMapNodeEdit) {
  if (!edit.node.id.trim() || !validBacklogTitle(edit.node.title.trim())) return false;
  if (edit.kind === "card") return (edit.node.description?.length ?? 0) <= 500;
  if (edit.kind === "slice") return (edit.node.outcome?.length ?? 0) <= 300;
  return true;
}

export function saveStoryMapNode(base: StoryMapRecord, edit: StoryMapNodeEdit) {
  return withStoryMapWrite(
    Effect.gen(function* () {
      if (!validNode(edit)) return yield* new StoryMapError({ reason: "journey" });
      const current = yield* freshStoryMap(base);
      if (!destinationsAreValid(current, edit))
        return yield* new StoryMapError({ reason: "journey" });
      const field = fieldFor[edit.kind];
      const rows = replaceStoryMapRow(base, field, cleanNode(edit), [
        "sliceId",
        "outcome",
        "description",
      ]);
      return yield* writeStoryMap(base, current, { [field]: rows }, (actual) =>
        destinationsAreValid(actual, edit),
      );
    }),
  );
}

export function storyMapCardsForCell(
  map: StoryMapRecord,
  stepId: string | undefined,
  sliceId?: string,
) {
  return map.cards.filter((card) => card.stepId === stepId && card.sliceId === sliceId);
}

function peers(map: StoryMapRecord, kind: StoryMapNodeEdit["kind"], id: string) {
  if (kind === "step") {
    const step = map.steps.find((candidate) => candidate.id === id);
    return map.steps.filter(({ activityId }) => activityId === step?.activityId);
  }
  if (kind === "card") {
    const card = map.cards.find((candidate) => candidate.id === id);
    return storyMapCardsForCell(map, card?.stepId, card?.sliceId);
  }
  return map[fieldFor[kind]];
}

export function moveStoryMapNode(
  base: StoryMapRecord,
  kind: StoryMapNodeEdit["kind"],
  id: string,
  offset: -1 | 1,
) {
  return withStoryMapWrite(
    Effect.gen(function* () {
      const current = yield* freshStoryMap(base);
      const adjacent = peers(current, kind, id);
      const selected = adjacent.findIndex((row) => row.id === id);
      const target = adjacent[selected + offset];
      if (selected < 0 || !target) return yield* new StoryMapError({ reason: "journey" });
      const field = fieldFor[kind];
      const rows = rawRows(current, field);
      const original = rows.findIndex((row) => withNodeId(row, id));
      const next = rows.findIndex((row) => withNodeId(row, target.id));
      return yield* writeStoryMap(current, current, {
        [field]: rows.with(original, rows[next]).with(next, rows[original]),
      });
    }),
  );
}

export function saveStoryMapHeader(base: StoryMapRecord, input: StoryMapDraft) {
  return withStoryMapWrite(
    Effect.gen(function* () {
      const draft = {
        title: input.title.trim(),
        persona: input.persona.trim(),
        goal: input.goal.trim(),
      };
      if (storyMapFields.some((field) => storyMapFieldInvalid(field, draft[field])))
        return yield* new StoryMapError({ reason: "fields" });
      return yield* writeStoryMap(base, yield* freshStoryMap(base), draft);
    }),
  );
}
