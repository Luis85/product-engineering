import { Schema } from "effect";
import { backlogIdSchema, deliverableIdSchema, nfrIdSchema } from "../../domain/backlog";
import type { DeliverableId, NfrId } from "../../domain/backlog";
import { projectIdSchema } from "../projects";
import type { ProjectId } from "../projects";

export const PROJECT_BACKLOG = "project-backlog";
export const PROJECT_USE_CASE = "project-usecase";
export const backlogTabs = ["board", "list", "nfrs", "deliverables"] as const;
export type BacklogTab = (typeof backlogTabs)[number];

const pbiIdSchema = backlogIdSchema.check(Schema.isPattern(/^UC-/));
export const backlogBoardContextSchema = Schema.Struct({
  pbiId: pbiIdSchema,
  query: Schema.String,
  status: Schema.String,
  priority: Schema.String,
  scroll: Schema.Finite.check(Schema.isGreaterThanOrEqualTo(0)),
});
const backlogBoardReturnSchema = Schema.Struct({
  context: backlogBoardContextSchema,
  requestId: Schema.String,
});
export type BacklogBoardContext = typeof backlogBoardContextSchema.Type;
export type BacklogBoardReturn = typeof backlogBoardReturnSchema.Type;

export const projectBacklogSchema = Schema.Struct({
  name: Schema.Literal(PROJECT_BACKLOG),
  projectId: projectIdSchema,
  tab: Schema.optionalKey(Schema.Literals(backlogTabs)),
  item: Schema.optionalKey(backlogIdSchema),
  nfr: Schema.optionalKey(nfrIdSchema),
  nfrFromItem: Schema.optionalKey(backlogIdSchema),
  deliverable: Schema.optionalKey(deliverableIdSchema),
  boardReturn: Schema.optionalKey(backlogBoardReturnSchema),
  createPbi: Schema.optionalKey(Schema.Literal(true)),
});

export function deliverablesRoute(
  projectId: ProjectId,
  deliverable?: DeliverableId,
): typeof projectBacklogSchema.Type {
  return {
    name: PROJECT_BACKLOG,
    projectId,
    tab: "deliverables",
    ...(deliverable && { deliverable }),
  };
}

export function nfrCatalogRoute(
  projectId: ProjectId,
  nfr?: NfrId,
  nfrFromItem?: string,
): typeof projectBacklogSchema.Type {
  return {
    name: PROJECT_BACKLOG,
    projectId,
    tab: "nfrs",
    ...(nfr && { nfr }),
    ...(nfrFromItem && { nfrFromItem }),
  };
}

export function backlogBoardRoute(
  projectId: ProjectId,
  explicit = false,
): typeof projectBacklogSchema.Type {
  return { name: PROJECT_BACKLOG, projectId, ...(explicit && { tab: "board" as const }) };
}

export function backlogBoardReturnRoute(
  projectId: ProjectId,
  boardReturn: BacklogBoardReturn,
): typeof projectBacklogSchema.Type {
  return { ...backlogBoardRoute(projectId, true), boardReturn };
}

export function backlogRoute(
  projectId: ProjectId,
  item?: string,
): typeof projectBacklogSchema.Type {
  return { name: PROJECT_BACKLOG, projectId, tab: "list", ...(item && { item }) };
}

export function backlogCreatePbiRoute(projectId: ProjectId): typeof projectBacklogSchema.Type {
  return { ...backlogRoute(projectId), createPbi: true };
}

export const pbiTabs = ["usecase", "companions", "criteria", "links", "edit", "git"] as const;
export type PbiTab = (typeof pbiTabs)[number];

export const projectUseCaseSchema = Schema.Struct({
  name: Schema.Literal(PROJECT_USE_CASE),
  projectId: projectIdSchema,
  pbiId: pbiIdSchema,
  tab: Schema.optionalKey(Schema.Literals(pbiTabs)),
});

export function pbiDetailRoute(
  projectId: ProjectId,
  pbiId: string,
  tab?: PbiTab,
): typeof projectUseCaseSchema.Type {
  return { name: PROJECT_USE_CASE, projectId, pbiId, ...(tab && { tab }) };
}
