import type { KnowledgeKind } from "./kinds";

export const knowledgePrefixes = {
  actor: "AKT",
  entity: "ENT",
  vision: "VIS",
  jtbd: "JOB",
  research: "RES",
  prd: "PRD",
  design: "DES",
  "style-guide": "STY",
  "design-system": "DS",
  adr: "ADR",
  "system-description": "ARC",
  "test-concept": "TST",
  "operations-concept": "OPS",
  "roles-and-permissions": "RAC",
  "custom-concept": "KON",
} satisfies Record<KnowledgeKind, string>;

export type KnowledgeHeadings = Readonly<Record<KnowledgeKind, readonly string[]>>;

export function knowledgeTemplateBody(
  headings: KnowledgeHeadings,
  template: KnowledgeKind,
  requirementId?: string,
) {
  const numbered = template === "system-description";
  const sections = headings[template].map(
    (heading, index) =>
      `## ${numbered ? `${index + 1}. ` : ""}${heading.replace("{{REQ}}", requirementId ?? "")}`,
  );
  if (numbered) sections.push("[arc42](https://docs.arc42.org/home/)");
  return `\n${sections.join("\n\n")}\n`;
}
