import { deliverableDraftIssue } from "../../../domain/backlog";
import type { DeliverableDraft, DeliverableStatus } from "../../../domain/backlog";
import { isKnowledgeId } from "../../../domain/knowledge";
import { isProjectMemberId } from "../../../domain/projects";

export type EditorFields = {
  title: string;
  outcome: string;
  status: DeliverableStatus;
  owner_id: string;
  due: string;
  template: string;
  knowledge_id: string;
};

export type EditorIssue = NonNullable<ReturnType<typeof deliverableDraftIssue>>;

export function editorValues(value: EditorFields): DeliverableDraft {
  const { owner_id, knowledge_id, due, template, title, outcome, status } = value;
  return {
    title: title.trim(),
    outcome: outcome.trim(),
    status,
    ...(isProjectMemberId(owner_id) && { owner_id }),
    ...(due && { due }),
    ...(template && { template }),
    ...(isKnowledgeId(knowledge_id) && { knowledge_id }),
  };
}

export function editorIssue(
  input: EditorFields,
  values: DeliverableDraft,
): EditorIssue | undefined {
  if (input.owner_id && !values.owner_id) return "owner_id";
  if (input.knowledge_id && !values.knowledge_id) return "knowledge_id";
  return deliverableDraftIssue(values);
}

export function fieldError(
  field: keyof EditorFields,
  issue: EditorIssue | undefined,
  issueId: string,
) {
  return issue === field ? { "aria-invalid": true, "aria-describedby": issueId } : {};
}
