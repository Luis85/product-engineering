import { Effect } from "effect";
import { isKnowledgeId } from "../../domain/knowledge";
import type { Frontmatter } from "../../domain/notes";
import { resolveKnowledgeNote } from "../knowledge";
import type { KnowledgeRecord } from "../knowledge";
import type { ProjectId } from "../projects";
import type { BacklogEdit } from "./edit";
import { BacklogError } from "./model";

export const pbiSourceFields = {
  prd: "pbi_prd_id",
  jtbd: "pbi_job_id",
  research: "pbi_research_id",
  adr: "pbi_adr_id",
} as const;

export type PbiSourceKind = keyof typeof pbiSourceFields;
export const pbiSourceKinds = Object.keys(pbiSourceFields) as PbiSourceKind[];
export type PbiSourceDraft = Record<
  (typeof pbiSourceFields)[PbiSourceKind] | "pbi_requirement_id",
  string
>;
type PbiSourceReference = {
  readonly kind: PbiSourceKind;
  readonly id: string;
  readonly record?: KnowledgeRecord;
};

function sourceValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

export function pbiSourceDraft(fields: Frontmatter): PbiSourceDraft {
  return {
    pbi_prd_id: sourceValue(fields.pbi_prd_id),
    pbi_requirement_id: sourceValue(fields.pbi_requirement_id),
    pbi_job_id: sourceValue(fields.pbi_job_id),
    pbi_research_id: sourceValue(fields.pbi_research_id),
    pbi_adr_id: sourceValue(fields.pbi_adr_id),
  };
}

export function resolvePbiSource(project: ProjectId, kind: PbiSourceKind, id: unknown) {
  if (!isKnowledgeId(id)) return Effect.succeed(undefined);
  return Effect.map(resolveKnowledgeNote(project, id), (record) =>
    record?.kind === kind ? record : undefined,
  );
}

export function resolvePbiSources(project: ProjectId, fields: Frontmatter) {
  const draft = pbiSourceDraft(fields);
  return Effect.forEach(pbiSourceKinds, (kind) =>
    Effect.map(
      resolvePbiSource(project, kind, draft[pbiSourceFields[kind]]),
      (record): PbiSourceReference => ({
        kind,
        id: draft[pbiSourceFields[kind]],
        ...(record && { record }),
      }),
    ),
  );
}

export function editedPbiSources(project: ProjectId, before: BacklogEdit, next: PbiSourceDraft) {
  return Effect.gen(function* () {
    const previous = pbiSourceDraft(before.item.fields);
    const changes: Partial<Record<keyof PbiSourceDraft, string | undefined>> = {};
    for (const kind of pbiSourceKinds) {
      const field = pbiSourceFields[kind];
      const id = next[field];
      if (id === previous[field] && !requirementChanged(kind, previous, next)) continue;
      yield* verifySource(project, kind, id, next.pbi_requirement_id);
      if (kind === "prd") changes.pbi_requirement_id = next.pbi_requirement_id || undefined;
      changes[field] = id || undefined;
    }
    return changes;
  });
}

function requirementChanged(kind: PbiSourceKind, previous: PbiSourceDraft, next: PbiSourceDraft) {
  return kind === "prd" && next.pbi_requirement_id !== previous.pbi_requirement_id;
}

function verifySource(project: ProjectId, kind: PbiSourceKind, id: string, requirement: string) {
  return Effect.gen(function* () {
    const record = id ? yield* resolvePbiSource(project, kind, id) : undefined;
    if (id && !record) return yield* new BacklogError({ reason: "sources" });
    if (kind === "prd" && !validRequirement(record, requirement))
      return yield* new BacklogError({ reason: "sources" });
  });
}

function validRequirement(record: KnowledgeRecord | undefined, requirement: string) {
  return record
    ? Boolean(requirement && record.values.requirement_id === requirement)
    : !requirement;
}
