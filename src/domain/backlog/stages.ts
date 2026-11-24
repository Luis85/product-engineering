export const boardStages = [
  "Backlog",
  "Open",
  "In Progress",
  "Review",
  "In Development",
  "Done",
] as const;

export type BoardStage = (typeof boardStages)[number];

const aliases = new Map<string, BoardStage>([
  ["backlog", "Backlog"],
  ["open", "Open"],
  ["offen", "Open"],
  ["in progress", "In Progress"],
  ["in arbeit", "In Progress"],
  ["active", "In Progress"],
  ["review", "Review"],
  ["in prüfung", "Review"],
  ["in development", "In Development"],
  ["in entwicklung", "In Development"],
  ["done", "Done"],
  ["erledigt", "Done"],
]);

export function normalizedBoardStage(state: string) {
  return aliases.get(state.trim().toLowerCase());
}

export function mappedBoardStage(stage: BoardStage, states: readonly string[]) {
  return states.find((state) => normalizedBoardStage(state) === stage) ?? stage;
}
