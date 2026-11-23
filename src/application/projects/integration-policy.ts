import { Effect, Result } from "effect";
import { isProjectDataClass, projectType } from "../../domain/projects";
import type { ProjectDataClass, ProjectId } from "../../domain/projects";
import type { ProjectMcpCandidate } from "../integrations";
import { editChange } from "../notes";
import { projectById } from "./discovery";
import type { ProjectSettings } from "./discovery";
import { ProjectIntegrationError } from "./errors";
import { readFreshProject, updateProjectFrontmatter } from "./registration";

export function projectIntegrationPolicy(project: ProjectSettings) {
  const { fields } = projectType;
  const { frontmatter } = project;
  const classification = fields.data_class.check(frontmatter.data_class);
  const sharing = fields.mcp_read.check(frontmatter.mcp_read);
  const dataClass = Result.isSuccess(classification)
    ? (classification.success ?? "internal")
    : undefined;
  return { dataClass, mcpRead: Result.isSuccess(sharing) && sharing.success === true };
}

export const projectDeliverySettings = (projectId: ProjectId) =>
  Effect.map(projectById(projectId), (project) => {
    if (!project) return;
    const { repository, branch } = project;
    return { repository, branch, ...projectIntegrationPolicy(project) };
  });

export function setProjectMcpRead(projectId: ProjectId, enabled: boolean) {
  return updateProjectFrontmatter(projectId, () => Result.succeed({ set: { mcp_read: enabled } }));
}

export function setProjectDataClass(project: ProjectSettings, dataClass: ProjectDataClass) {
  return Effect.gen(function* () {
    if (!isProjectDataClass(dataClass))
      return yield* new ProjectIntegrationError({ reason: "data_class" });
    return yield* updateProjectFrontmatter(
      project.id,
      editChange(projectType, project.frontmatter, {
        ...project.frontmatter,
        data_class: dataClass,
      }),
    );
  });
}

export function currentProjectMcpCandidate(projectId: ProjectId) {
  return Effect.map(readFreshProject(projectId), (project): ProjectMcpCandidate | undefined => {
    if (!project) return;
    const { id, name, repository, branch } = project;
    return { id, name, repository, branch, ...projectIntegrationPolicy(project) };
  }).pipe(Effect.catch(() => Effect.succeed(undefined)));
}
