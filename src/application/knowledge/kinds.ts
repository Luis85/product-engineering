import { projectTemplateGroups } from "../projects";
import type { ProjectTemplateId } from "../projects";

export const knowledgeShelves = {
  foundations: ["research", "jtbd", "vision", "prd"],
  actors: ["actor"],
  domain: ["entity"],
  design: ["design", "style-guide", "design-system", "adr"],
  concepts: projectTemplateGroups.concepts,
  other: [],
} as const satisfies Readonly<Record<string, readonly ProjectTemplateId[]>>;

export type KnowledgeShelf = keyof typeof knowledgeShelves;
export type KnowledgeKind = (typeof knowledgeShelves)[KnowledgeShelf][number];
export const knowledgeKinds: readonly KnowledgeKind[] = Object.values(knowledgeShelves).flat();
export const isKnowledgeKind = (kind: string): kind is KnowledgeKind =>
  knowledgeKinds.some((known) => known === kind);
