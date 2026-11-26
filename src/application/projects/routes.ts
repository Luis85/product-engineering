import { Schema } from "effect";
import { lineOfText } from "../../domain/notes";
import { projectIdSchema } from "../../domain/projects";
import type { ProjectId } from "../../domain/projects";
import { projectTemplateIds } from "./templates";
import type { ProjectTemplateId } from "./templates";

export const PROJECTS = "projects";
export const PROJECT_OVERVIEW = "project-overview";
export const PROJECT_ADMINISTRATION = "project-administration";
export const PROJECT_RECORD = "project-record";
export const projectsRoute = { name: PROJECTS } as const;
export const projectChooserRoute = Schema.Struct({ name: Schema.Literal(PROJECTS) });

const key = Schema.String.check(Schema.isPattern(/^[a-z][a-z0-9-]{0,63}$/));
const reference = Schema.Struct({
  kind: key,
  recordId: lineOfText(160).check(
    Schema.isMinLength(1),
    Schema.makeFilter((id) => id.trim() === id),
  ),
});
export const isProjectRecordIdentifier = Schema.is(reference);

export const projectOriginSchema = Schema.Struct({
  section: key,
  reference: Schema.optionalKey(reference),
});

function scoped<const Name extends string>(name: Name) {
  return { name: Schema.Literal(name), projectId: projectIdSchema };
}

export const projectOverviewSchema = Schema.Struct({
  ...scoped(PROJECT_OVERVIEW),
  context: Schema.optionalKey(lineOfText(160).check(Schema.isMinLength(1))),
});
export const projectAdministrationSections = [
  "project",
  "team",
  "requirements",
  "definitions",
  "templates",
  "integrations",
] as const;
export type ProjectAdministrationSection = (typeof projectAdministrationSections)[number];
export const projectAdministrationSchema = Schema.Struct({
  ...scoped(PROJECT_ADMINISTRATION),
  section: Schema.optionalKey(Schema.Literals(projectAdministrationSections)),
  returnTemplate: Schema.optionalKey(Schema.Literals(projectTemplateIds)),
});
export type ProjectAdministrationRoute = typeof projectAdministrationSchema.Type;
export const projectRecordSchema = Schema.Struct({
  ...scoped(PROJECT_RECORD),
  reference,
  origin: Schema.optionalKey(projectOriginSchema),
});

export type ProjectOrigin = typeof projectOriginSchema.Type;
export type ProjectReference = typeof reference.Type & { readonly projectId: ProjectId };
export type ProjectRecordRoute = typeof projectRecordSchema.Type;

export const projectOverviewRoute = (
  projectId: ProjectId,
  context?: string,
): typeof projectOverviewSchema.Type => ({
  name: PROJECT_OVERVIEW,
  projectId,
  ...(context && { context }),
});
export const projectAdministrationRoute = (
  projectId: ProjectId,
  section?: ProjectAdministrationSection,
): ProjectAdministrationRoute => ({
  name: PROJECT_ADMINISTRATION,
  projectId,
  ...(section && { section }),
});
export const projectTemplateReturnRoute = (
  projectId: ProjectId,
  returnTemplate: ProjectTemplateId,
): ProjectAdministrationRoute => ({
  ...projectAdministrationRoute(projectId, "templates"),
  returnTemplate,
});

export function projectRecordRoute(
  { projectId, kind, recordId }: ProjectReference,
  origin?: ProjectOrigin,
): ProjectRecordRoute {
  return {
    name: PROJECT_RECORD,
    projectId,
    reference: { kind, recordId },
    ...(origin && { origin }),
  };
}
