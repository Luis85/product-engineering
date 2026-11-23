import { Effect, Result } from "effect";
import { recordId } from "../../domain/notes";
import type { Frontmatter } from "../../domain/notes";
import {
  encodeProjectMembers,
  isMemberName,
  isProjectMemberId,
  isProjectRole,
  projectType,
  sameMemberAssignment,
} from "../../domain/projects";
import type { ProjectId, ProjectMemberDraft, ProjectMemberId } from "../../domain/projects";
import { IdGenerator } from "../notes";
import { projectById } from "./discovery";
import type { ProjectSettings } from "./discovery";
import { ProjectMemberError } from "./errors";
import { updateProjectFrontmatter } from "./registration";

function membersOf(frontmatter: Frontmatter) {
  const result = projectType.fields.team.check(frontmatter.team);
  return Result.isSuccess(result) ? (result.success ?? []) : undefined;
}

export const projectMembers = (project: ProjectSettings) => membersOf(project.frontmatter);

export const projectMemberChoices = (id: ProjectId) =>
  Effect.map(projectById(id), (project) => project && projectMembers(project));

export const resolveProjectMember = (projectId: ProjectId, memberId: ProjectMemberId) =>
  Effect.map(projectMemberChoices(projectId), (members) =>
    members?.find(({ id }) => id === memberId),
  );

export const newProjectMemberId = IdGenerator.use(({ nextId }) =>
  Effect.map(nextId, (uuid) => {
    const id = recordId("project-member", uuid);
    if (!isProjectMemberId(id)) throw new Error("The host generated an invalid project member ID");
    return id;
  }),
);

export function addProjectMember(
  projectId: ProjectId,
  id: ProjectMemberId,
  draft: ProjectMemberDraft,
) {
  const name = draft.name.trim();
  const { role } = draft;
  if (!isMemberName(name)) return Effect.fail(new ProjectMemberError({ reason: "name" }));
  if (!isProjectRole(role)) return Effect.fail(new ProjectMemberError({ reason: "role" }));
  return updateProjectFrontmatter(projectId, (frontmatter) => {
    const members = membersOf(frontmatter);
    if (!members || !isProjectMemberId(id))
      return Result.fail(new ProjectMemberError({ reason: "unavailable" }));
    const assignment = { name, role };
    const existing = members.find((member) => member.id === id);
    if (existing && sameMemberAssignment(existing, assignment)) return Result.succeed({});
    if (existing || members.some((member) => sameMemberAssignment(member, assignment))) {
      return Result.fail(new ProjectMemberError({ reason: "duplicate" }));
    }
    return Result.succeed({
      set: { team: encodeProjectMembers([...members, { id, ...assignment }]) },
    });
  });
}
