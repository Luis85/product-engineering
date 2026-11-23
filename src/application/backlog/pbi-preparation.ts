import { Effect, Result } from "effect";
import { completePbiCriterion, pbiCriterionDraft } from "../../domain/backlog";
import { isKnowledgeId } from "../../domain/knowledge";
import { inspectArtifactGit } from "../git";
import {
  knowledgeDetailRoute,
  knowledgeGitSource,
  knowledgeNoteOptions,
  resolveKnowledgeNote,
} from "../knowledge";
import type { KnowledgeRecord } from "../knowledge";
import { projectArtifactRules, projectIntegrationPolicy, readFreshProject } from "../projects";
import type { ProjectId, ProjectSettings } from "../projects";
import { backlogGitSource } from "./contributions";
import { BacklogError } from "./model";
import { readPbiDetail } from "./pbi-detail";
import type { PbiDetail } from "./pbi-detail";
import { pbiSourceDraft } from "./pbi-sources";
import { savePbiContent } from "./pbi-storage";

export type PbiPreparationReason =
  | "prd"
  | "prdApproval"
  | "vision"
  | "research"
  | "adr"
  | "adrApproval"
  | "criteria"
  | "scenario"
  | "repository"
  | "approval"
  | "gitPending"
  | "gitUnavailable";

export type PbiPreparationGap = {
  readonly reason: PbiPreparationReason;
  readonly record?: KnowledgeRecord;
};

function linked(detail: PbiDetail, kind: PbiDetail["sources"][number]["kind"]) {
  return detail.sources.find((entry) => entry.kind === kind);
}

function selectedVision(project: ProjectId, prd: KnowledgeRecord | undefined) {
  return Effect.gen(function* () {
    const explicit = prd?.values.vision_id;
    if (isKnowledgeId(explicit)) {
      const record = yield* resolveKnowledgeNote(project, explicit);
      return record?.kind === "vision" ? record : undefined;
    }
    const records = yield* knowledgeNoteOptions(project);
    const candidates = records.filter(({ kind }) => kind === "vision");
    for (const candidate of candidates) {
      const current = yield* resolveKnowledgeNote(project, candidate.id);
      if (current?.kind === "vision" && current.values.approval === "approved") return current;
    }
    const first = candidates[0];
    return first ? yield* resolveKnowledgeNote(project, first.id) : undefined;
  });
}

function requirementGap(
  prd: KnowledgeRecord | undefined,
  requirement: string,
): PbiPreparationGap | undefined {
  if (!prd || !requirement || prd.values.requirement_id !== requirement) return { reason: "prd" };
  if (prd.values.approval !== "approved") return { reason: "prdApproval", record: prd };
}

function visionGap(vision: KnowledgeRecord | undefined): PbiPreparationGap | undefined {
  if (!vision) return { reason: "vision" };
  if (vision.values.approval !== "approved") return { reason: "vision", record: vision };
}

function researchGap(detail: PbiDetail): PbiPreparationGap | undefined {
  if (!linked(detail, "jtbd")?.record || !linked(detail, "research")?.record)
    return { reason: "research" };
}

function adrGap(detail: PbiDetail): PbiPreparationGap | undefined {
  const adr = linked(detail, "adr");
  if (!adr?.id && detail.edit.item.fields.pbi_integration_change !== true) return;
  if (!adr?.record) return { reason: "adr" };
  if (adr.record.values.approval !== "approved")
    return { reason: "adrApproval", record: adr.record };
}

function scenarioGap(criteria: PbiDetail["criteria"]): PbiPreparationGap | undefined {
  if (!criteria) return { reason: "scenario" };
  if (!criteria.length) return { reason: "criteria" };
  if (criteria.some((entry) => !completePbiCriterion(pbiCriterionDraft(entry))))
    return { reason: "scenario" };
}

function deliveryDestination(project: ProjectSettings | undefined) {
  if (!project?.repository || !project.branch) return;
  const policy = projectIntegrationPolicy(project);
  if (policy.dataClass)
    return { ...policy, repository: project.repository, branch: project.branch };
}

function requiredArtifacts(detail: PbiDetail) {
  return Effect.gen(function* () {
    const { projectId, edit, criteria } = detail;
    const project = yield* readFreshProject(projectId);
    const rules = project ? projectArtifactRules(project) : [];
    const prd = linked(detail, "prd")?.record;
    const requirement = pbiSourceDraft(edit.item.fields).pbi_requirement_id;
    const vision = yield* selectedVision(projectId, prd);
    const delivery = deliveryDestination(project);
    const enabled = (id: "research-jtbd" | "integration-adr") =>
      rules.find((rule) => rule.id === id)?.required !== false;
    const gaps = [
      requirementGap(prd, requirement),
      visionGap(vision),
      enabled("research-jtbd") ? researchGap(detail) : undefined,
      enabled("integration-adr") ? adrGap(detail) : undefined,
      scenarioGap(criteria),
      delivery ? undefined : { reason: "repository" as const },
    ].filter((gap) => gap !== undefined);
    return { gaps, vision, delivery, requirement };
  });
}

function deliveryInput(detail: PbiDetail, record?: KnowledgeRecord) {
  const { projectId, pbiId } = detail;
  const source = record
    ? knowledgeGitSource(knowledgeDetailRoute(projectId, record.id))
    : backlogGitSource(projectId, pbiId);
  return Effect.map(Effect.result(inspectArtifactGit(source)), (result) => ({
    id: record?.id ?? pbiId,
    ...(record && { record }),
    ...(Result.isFailure(result)
      ? { state: "unavailable" as const }
      : {
          state: result.success.state,
          commit: result.success.revisions[0]?.oid,
          path: result.success.target.path,
        }),
  }));
}

export function inspectPbiPreparation(detail: PbiDetail) {
  return Effect.gen(function* () {
    const { gaps: prerequisites, vision, delivery, requirement } = yield* requiredArtifacts(detail);
    const records = detail.sources.flatMap(({ record }) => (record ? [record] : []));
    const inputs = delivery
      ? yield* Effect.forEach(
          [undefined, ...(vision ? [vision] : []), ...records],
          (record) => deliveryInput(detail, record),
          { concurrency: 4 },
        )
      : [];
    const gaps = [...prerequisites];
    if (detail.approval !== "approved") gaps.push({ reason: "approval" });
    for (const input of inputs) {
      if (input.state === "clean" && input.commit) continue;
      gaps.push({
        reason: input.state === "unavailable" ? "gitUnavailable" : "gitPending",
        ...(input.record && { record: input.record }),
      });
    }
    return { gaps, prerequisites, inputs, vision, delivery, requirement, ready: gaps.length === 0 };
  });
}

export type PbiPreparation = Effect.Success<ReturnType<typeof inspectPbiPreparation>>;

export function approvePbi(detail: PbiDetail) {
  return Effect.gen(function* () {
    const current = yield* readPbiDetail(detail.projectId, detail.pbiId);
    const { gaps } = yield* requiredArtifacts(current);
    if (gaps.length) return yield* new BacklogError({ reason: "approval" });
    return yield* savePbiContent(detail.projectId, detail.edit, {}, detail.edit.draft.body, true);
  });
}
