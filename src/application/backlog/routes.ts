import { Schema } from "effect";
import { backlogIdSchema, nfrIdSchema } from "../../domain/backlog";
import type { NfrId } from "../../domain/backlog";
import { projectIdSchema } from "../projects";
import type { ProjectId } from "../projects";

export const PROJECT_BACKLOG = "project-backlog";
export const PROJECT_USE_CASE = "project-usecase";
export const backlogTabs = ["board", "list", "nfrs", "deliverables"] as const;
export type BacklogTab = (typeof backlogTabs)[number];

export const projectBacklogSchema = Schema.Struct({
  name: Schema.Literal(PROJECT_BACKLOG),
  projectId: projectIdSchema,
  tab: Schema.optionalKey(Schema.Literals(["board", "list", "nfrs"])),
  item: Schema.optionalKey(backlogIdSchema),
  nfr: Schema.optionalKey(nfrIdSchema),
  nfrFromItem: Schema.optionalKey(backlogIdSchema),
});

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

export function backlogRoute(
  projectId: ProjectId,
  item?: string,
): typeof projectBacklogSchema.Type {
  return { name: PROJECT_BACKLOG, projectId, tab: "list", ...(item && { item }) };
}

export const pbiTabs = ["usecase", "companions", "criteria", "links", "edit", "git"] as const;
export type PbiTab = (typeof pbiTabs)[number];

export const projectUseCaseSchema = Schema.Struct({
  name: Schema.Literal(PROJECT_USE_CASE),
  projectId: projectIdSchema,
  pbiId: backlogIdSchema.check(Schema.isPattern(/^UC-/)),
  tab: Schema.optionalKey(Schema.Literals(pbiTabs)),
});

export function pbiDetailRoute(
  projectId: ProjectId,
  pbiId: string,
  tab?: PbiTab,
): typeof projectUseCaseSchema.Type {
  return { name: PROJECT_USE_CASE, projectId, pbiId, ...(tab && { tab }) };
}
