import type { BacklogItem } from "../backlog";
import type { StoryMapRecord } from "./records";

function linkedStoryCount(map: StoryMapRecord, valid: ReadonlySet<string | undefined>) {
  const cards = new Set(map.cards.map(({ id }) => id));
  const linked = new Set<string>();
  for (const { cardId, projectId, recordId } of map.cardLinks) {
    if (projectId === map.projectId && cards.has(cardId) && valid.has(recordId)) linked.add(cardId);
  }
  return linked.size;
}

export function storyMapRows(maps: readonly StoryMapRecord[], items: readonly BacklogItem[]) {
  const valid = new Set(
    items.filter(({ adopted, conflict }) => adopted && !conflict).map(({ id }) => id),
  );
  return maps.map((map) => ({
    ...map,
    storyCount: map.cards.length,
    linkedStoryCount: linkedStoryCount(map, valid),
  }));
}
