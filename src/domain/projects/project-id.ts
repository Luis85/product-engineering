import { Schema } from "effect";
import { recordIdIssue } from "../notes";

export const projectIdSchema = Schema.TemplateLiteral(["project-", Schema.String]).check(
  Schema.makeFilter((id) => recordIdIssue("project", id) === undefined),
);
export type ProjectId = typeof projectIdSchema.Type;
export const isProjectId = Schema.is(projectIdSchema);
