import type { StorySliceCreation } from "../../domain/story-maps";
import type { StoryMapRecord } from "./records";

export type StorySliceCard = { readonly sliceId: string; readonly cardId: string };

export function inStorySlice(map: StoryMapRecord, { sliceId, cardId }: StorySliceCard) {
  const card = map.cards.find(({ id }) => id === cardId);
  const step = map.steps.find(({ id }) => id === card?.stepId);
  return (
    card?.sliceId === sliceId &&
    map.slices.some(({ id }) => id === sliceId) &&
    !!step &&
    map.activities.some(({ id }) => id === step.activityId)
  );
}

export function sameSliceCard(a: StorySliceCard, b: StorySliceCard) {
  return a.cardId === b.cardId && a.sliceId === b.sliceId;
}

export function isStorySliceDeferred(map: StoryMapRecord, target: StorySliceCard) {
  return map.sliceDeferrals.some((row) => sameSliceCard(row, target));
}

export function pendingStorySliceCreation(map: StoryMapRecord, target: StorySliceCard) {
  return map.sliceHandoffs.find(
    (row): row is StorySliceCreation => row.state === "pending" && sameSliceCard(row, target),
  );
}

export function hasPendingStoryCreation(map: StoryMapRecord, cardId: string) {
  return map.sliceHandoffs.some((row) => row.state === "pending" && row.cardId === cardId);
}

export function pendingStoryCreationElsewhere(map: StoryMapRecord, target: StorySliceCard) {
  return map.sliceHandoffs.find(
    (row) =>
      row.state === "pending" && row.cardId === target.cardId && row.sliceId !== target.sliceId,
  );
}

export function storySliceForRecovery(map: StoryMapRecord, target: StorySliceCard) {
  const pending = pendingStoryCreationElsewhere(map, target);
  if (!pending) return;
  return map.slices.find(({ id }) => id === pending.sliceId)?.title ?? pending.sliceId;
}
