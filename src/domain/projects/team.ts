import { Result, Schema } from "effect";
import { lineOfText, recordIdIssue } from "../notes";

export const projectRoles = [
  "product-owner",
  "requirements",
  "research",
  "architecture",
  "qa",
  "factory",
] as const;
const role = Schema.Literals(projectRoles);
export type ProjectRole = typeof role.Type;
export const projectMemberIdSchema = Schema.TemplateLiteral([
  "project-member-",
  Schema.String,
]).check(Schema.makeFilter((id) => recordIdIssue("project-member", id) === undefined));
export type ProjectMemberId = typeof projectMemberIdSchema.Type;
export const isProjectMemberId = Schema.is(projectMemberIdSchema);
const name = lineOfText(100).check(
  Schema.isMinLength(1),
  Schema.makeFilter((value) => value === value.trim()),
);
const member = Schema.Struct({ id: projectMemberIdSchema, name, role });
export type ProjectMember = typeof member.Type;
export type ProjectMemberDraft = Pick<ProjectMember, "name" | "role">;
export const isMemberName = Schema.is(name);
export const isProjectRole = Schema.is(role);

export const sameMemberAssignment = (left: ProjectMemberDraft, right: ProjectMemberDraft) =>
  left.role === right.role &&
  left.name.normalize("NFC").toLowerCase() === right.name.normalize("NFC").toLowerCase();

const members = Schema.Array(Schema.fromJsonString(member)).check(
  Schema.makeFilter((entries) =>
    entries.every((entry, index) =>
      entries
        .slice(0, index)
        .every((previous) => previous.id !== entry.id && !sameMemberAssignment(previous, entry)),
    ),
  ),
);
const decode = Schema.decodeUnknownResult(members);
export const encodeProjectMembers = Schema.encodeSync(members);
export const projectTeamField = {
  check(input: unknown) {
    return input === undefined || input === null
      ? Result.succeed(undefined)
      : Result.mapError(decode(input), () => "team.invalid" as const);
  },
};
