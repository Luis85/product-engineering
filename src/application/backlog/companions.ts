import type { BacklogItem } from "./model";

export const companionKinds = ["TASK", "ISS", "Q", "BUG"] as const;
export type CompanionKind = (typeof companionKinds)[number];

export const pbiWorkIsOpen = ({ state }: Pick<BacklogItem, "state">) =>
  !/^(done|closed|erledigt|geschlossen)$/i.test(state);

export function pbiCompanions(items: readonly BacklogItem[], pbi: BacklogItem) {
  const children = items.filter(({ parent }) => parent === pbi.key);
  const open = children.filter(pbiWorkIsOpen);
  return { items: children, open: open.length, total: children.length };
}
