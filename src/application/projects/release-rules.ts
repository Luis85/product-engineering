import { Effect, Result } from "effect";
import { recordId } from "../../domain/notes";
import type { Frontmatter } from "../../domain/notes";
import {
  defaultProjectReleaseRules,
  encodeProjectReleaseRules,
  isCriterionTitle,
  isCriterionType,
  isProjectCriterionId,
  projectGatePhases,
  projectType,
} from "../../domain/projects";
import type {
  ProjectCriterion,
  ProjectCriterionDraft,
  ProjectCriterionId,
  ProjectGatePhase,
  ProjectId,
  ProjectReleaseRules,
} from "../../domain/projects";
import { IdGenerator } from "../notes";
import type { ProjectSettings } from "./discovery";
import { ProjectCriterionError } from "./errors";
import { readFreshProject, updateProjectFrontmatter } from "./registration";

function rulesOf(frontmatter: Frontmatter) {
  const parsed = projectType.fields.release_rules.check(frontmatter.release_rules);
  return Result.isSuccess(parsed) ? (parsed.success ?? defaultProjectReleaseRules()) : undefined;
}

export const projectReleaseRules = (project: ProjectSettings) => rulesOf(project.frontmatter);

function active(criteria: readonly ProjectCriterion[]) {
  return Object.freeze(
    criteria.filter(({ enabled }) => enabled).map((criterion) => Object.freeze({ ...criterion })),
  );
}

function snapshotProjectReleaseRules(projectId: ProjectId, rules: ProjectReleaseRules) {
  return Object.freeze({
    projectId,
    version: rules.version,
    ready: active(rules.ready),
    done: active(rules.done),
  });
}

export type ProjectReleaseRuleSnapshot = ReturnType<typeof snapshotProjectReleaseRules>;

export const captureProjectReleaseRules = (projectId: ProjectId) =>
  Effect.map(readFreshProject(projectId), (project) => {
    const rules = project && projectReleaseRules(project);
    return rules && snapshotProjectReleaseRules(projectId, rules);
  }).pipe(Effect.catch(() => Effect.succeed(undefined)));

export const newProjectCriterionId = IdGenerator.use(({ nextId }) =>
  Effect.map(nextId, (uuid) => {
    const id = recordId("project-criterion", uuid);
    if (!isProjectCriterionId(id))
      throw new Error("The host generated an invalid project criterion ID");
    return id;
  }),
);

function sameCriterion(current: ProjectCriterion | undefined, next: ProjectCriterion) {
  return (
    current?.title === next.title && current.type === next.type && current.enabled === next.enabled
  );
}

export function saveProjectCriterion(
  projectId: ProjectId,
  expectedVersion: number,
  phase: ProjectGatePhase,
  id: ProjectCriterionId,
  draft: ProjectCriterionDraft,
) {
  const title = draft.title.trim();
  const { type, enabled } = draft;
  if (!isCriterionTitle(title)) return Effect.fail(new ProjectCriterionError({ reason: "title" }));
  if (!isCriterionType(type)) return Effect.fail(new ProjectCriterionError({ reason: "type" }));
  if (
    !projectGatePhases.includes(phase) ||
    !isProjectCriterionId(id) ||
    typeof enabled !== "boolean"
  ) {
    return Effect.fail(new ProjectCriterionError({ reason: "unavailable" }));
  }
  const other = phase === "ready" ? "done" : "ready";
  const value = { id, title, type, enabled };
  return updateProjectFrontmatter(projectId, (frontmatter) => {
    const rules = rulesOf(frontmatter);
    if (!rules) return Result.fail(new ProjectCriterionError({ reason: "unavailable" }));
    const existing = rules[phase].find((criterion) => criterion.id === id);
    if (sameCriterion(existing, value)) return Result.succeed({});
    if (rules.version !== expectedVersion || rules[other].some((criterion) => criterion.id === id))
      return Result.fail(new ProjectCriterionError({ reason: "conflict" }));
    if (rules.version === Number.MAX_SAFE_INTEGER)
      return Result.fail(new ProjectCriterionError({ reason: "unavailable" }));
    const criteria = existing
      ? rules[phase].map((criterion) => (criterion.id === id ? value : criterion))
      : [...rules[phase], value];
    return Result.succeed({
      set: {
        release_rules: encodeProjectReleaseRules({
          ...rules,
          version: rules.version + 1,
          [phase]: criteria,
        }),
      },
    });
  });
}
