export const projectTemplateGroups = {
  product: [
    "vision",
    "jtbd",
    "research",
    "prd",
    "actor",
    "entity",
    "design",
    "style-guide",
    "design-system",
    "adr",
    "pbi",
  ],
  concepts: [
    "system-description",
    "test-concept",
    "operations-concept",
    "roles-and-permissions",
    "custom-concept",
  ],
} as const;

export const projectTemplateIds = [
  ...projectTemplateGroups.product,
  ...projectTemplateGroups.concepts,
] as const;
export type ProjectTemplateId = (typeof projectTemplateIds)[number];
