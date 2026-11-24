import { Effect, Result } from "effect";
import { completePbiCriterion, pbiCriteria, pbiCriterionDraft } from "../../domain/backlog";
import type { Frontmatter } from "../../domain/notes";
import { isKnowledgeId } from "../../domain/knowledge";
import { inspectArtifactGit } from "../git";
import {
  knowledgeDetailRoute,
  knowledgeGitSource,
  knowledgeNoteOptions,
  resolveKnowledgeNote,
} from "../knowledge";
import type { KnowledgeRecord } from "../knowledge";
import { NoteStore } from "../notes";
import { projectArtifactRules, projectIntegrationPolicy, readFreshProject } from "../projects";
import type { ProjectId, ProjectSettings } from "../projects";
import { backlogGitSource } from "./contributions";
import { BacklogError } from "./model";
import type { BacklogItem } from "./model";
import { readPbiDetail } from "./pbi-detail";
import type { PbiDetail } from "./pbi-detail";
import { pbiSourceDraft } from "./pbi-sources";
import { pbiApproval, savePbiContent } from "./pbi-storage";

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

type PbiSources = Readonly<PbiDetail["sources"]>;

function linked(sources: PbiSources, kind: PbiSources[number]["kind"]) {
  return sources.find((entry) => entry.kind === kind);
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

function researchGap(sources: PbiSources): PbiPreparationGap | undefined {
  if (!linked(sources, "jtbd")?.record || !linked(sources, "research")?.record)
    return { reason: "research" };
}

function adrGap(sources: PbiSources, fields: Frontmatter): PbiPreparationGap | undefined {
  const adr = linked(sources, "adr");
  if (!adr?.id && fields.pbi_integration_change !== true) return;
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

function artifactGaps(
  sources: PbiSources,
  fields: Frontmatter,
  vision: KnowledgeRecord | undefined,
  project: ProjectSettings | undefined,
  delivery: ReturnType<typeof deliveryDestination>,
) {
  const rules = project ? projectArtifactRules(project) : [];
  const enabled = (id: "research-jtbd" | "integration-adr") =>
    rules.find((rule) => rule.id === id)?.required !== false;
  return [
    requirementGap(linked(sources, "prd")?.record, pbiSourceDraft(fields).pbi_requirement_id),
    visionGap(vision),
    enabled("research-jtbd") ? researchGap(sources) : undefined,
    enabled("integration-adr") ? adrGap(sources, fields) : undefined,
    scenarioGap(pbiCriteria(fields.pbi_criteria)),
    delivery ? undefined : { reason: "repository" as const },
  ].filter((gap) => gap !== undefined);
}

export function inspectIndexedPbiPreparation(
  item: BacklogItem,
  sources: PbiSources,
  records: ReadonlyMap<string, KnowledgeRecord>,
  fallbackVision: KnowledgeRecord | undefined,
  project: ProjectSettings | undefined,
) {
  return Effect.gen(function* (): Effect.fn.Return<
    PbiPreparationReason | "unavailable" | undefined,
    never,
    NoteStore
  > {
    const id = linked(sources, "prd")?.record?.values.vision_id;
    const vision = id ? indexedVision(records, id) : fallbackVision;
    const gap = artifactGaps(
      sources,
      item.fields,
      vision,
      project,
      deliveryDestination(project),
    )[0];
    if (gap) return gap.reason;
    if (!item.fields.pbi_approved_revision) return "approval";
    return yield* indexedApprovalGap(item);
  });
}

function indexedVision(records: ReadonlyMap<string, KnowledgeRecord>, id: string) {
  const record = records.get(id);
  return record?.kind === "vision" ? record : undefined;
}

function indexedApprovalGap(item: BacklogItem) {
  return Effect.gen(function* () {
    const store = yield* NoteStore;
    const result = yield* Effect.result(store.readContent(item.path));
    if (Result.isFailure(result)) return "unavailable" as const;
    const { frontmatter, body } = result.success;
    if (
      frontmatter.id !== item.fields.id ||
      frontmatter.project_id !== item.fields.project_id ||
      frontmatter["pe-id"] !== item.id
    )
      return "unavailable" as const;
    const title =
      typeof frontmatter.title === "string" && frontmatter.title ? frontmatter.title : item.title;
    if (pbiApproval(frontmatter, body, title) !== "approved") return "approval" as const;
  });
}

function requiredArtifacts(detail: PbiDetail) {
  return Effect.gen(function* () {
    const { projectId, edit, sources } = detail;
    const project = yield* readFreshProject(projectId);
    const prd = linked(sources, "prd")?.record;
    const requirement = pbiSourceDraft(edit.item.fields).pbi_requirement_id;
    const vision = yield* selectedVision(projectId, prd);
    const delivery = deliveryDestination(project);
    const gaps = artifactGaps(sources, edit.item.fields, vision, project, delivery);
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
