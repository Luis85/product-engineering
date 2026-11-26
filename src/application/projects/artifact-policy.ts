import { Effect, Result } from "effect";
import { projectType } from "../../domain/projects";
import type { ProjectId, ProjectRole } from "../../domain/projects";
import { editChange } from "../notes";
import { projectById } from "./discovery";
import type { ProjectSettings } from "./discovery";
import { updateProjectFrontmatter } from "./registration";

type OptionalArtifactField = "research_jtbd_required" | "integration_adr_required";

const artifactRules = [
  { id: "product-vision", role: "product-owner", field: undefined },
  { id: "solution-agnostic-prd", role: "requirements", field: undefined },
  { id: "research-jtbd", role: "research", field: "research_jtbd_required" },
  { id: "pbi-acceptance-ci", role: "qa", field: undefined },
  { id: "integration-adr", role: "architecture", field: "integration_adr_required" },
] as const satisfies readonly {
  readonly id: string;
  readonly role: ProjectRole;
  readonly field: OptionalArtifactField | undefined;
}[];

export type ProjectArtifactRuleId = (typeof artifactRules)[number]["id"];

export function projectArtifactRules(project: ProjectSettings) {
  return artifactRules.map(({ id, role, field }) => {
    const parsed =
      field === undefined
        ? Result.succeed(true)
        : projectType.fields[field].check(project.frontmatter[field]);
    return {
      id,
      role,
      fixed: field === undefined,
      field,
      required: Result.isSuccess(parsed) ? (parsed.success ?? true) : undefined,
    };
  });
}

export const projectArtifactPolicy = (projectId: ProjectId) =>
  Effect.map(projectById(projectId), (project) => project && projectArtifactRules(project));

export function setProjectArtifactRule(
  project: ProjectSettings,
  field: OptionalArtifactField,
  required: boolean,
) {
  return updateProjectFrontmatter(
    project.id,
    editChange(projectType, project.frontmatter, {
      ...project.frontmatter,
      [field]: required,
    }),
  );
}
