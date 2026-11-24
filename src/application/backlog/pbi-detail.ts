import { Effect, Schema } from "effect";
import { pbiCriteria } from "../../domain/backlog";
import { lineOfText } from "../../domain/notes";
import type { ProjectId } from "../projects";
import { backlogTitleIssue } from "./draft";
import { readBacklogItem } from "./edit";
import type { BacklogEdit } from "./edit";
import { BacklogError } from "./model";
import { editedPbiSources, resolvePbiSources } from "./pbi-sources";
import type { PbiSourceDraft } from "./pbi-sources";
import { pbiApproval, pbiRevision, savePbiContent } from "./pbi-storage";

const isReferenceList = Schema.is(Schema.Array(lineOfText(1024)));

export function readPbiDetail(projectId: ProjectId, pbiId: string) {
  return Effect.gen(function* () {
    const edit = yield* readBacklogItem(projectId, pbiId);
    if (!edit.item.adopted || edit.item.kind !== "UC" || edit.item.id !== pbiId)
      return yield* new BacklogError({ reason: "identity" });
    const fields = edit.item.fields;
    return {
      edit,
      projectId,
      pbiId,
      sources: yield* resolvePbiSources(projectId, fields),
      criteria: pbiCriteria(fields.pbi_criteria),
      revision: pbiRevision(fields),
      approval: pbiApproval(fields, edit.draft.body, edit.draft.title),
      references: isReferenceList(fields.pbi_references) ? fields.pbi_references : [],
    };
  });
}

export type PbiDetail = Effect.Success<ReturnType<typeof readPbiDetail>>;
export type PbiDraft = PbiSourceDraft & { title: string; body: string; integration: boolean };

export function savePbiDraft(project: ProjectId, before: BacklogEdit, draft: PbiDraft) {
  return Effect.gen(function* () {
    const title = draft.title.trim();
    if (backlogTitleIssue(title)) return yield* new BacklogError({ reason: "title" });
    const sources = yield* editedPbiSources(project, before, draft);
    const integration = draft.integration !== (before.item.fields.pbi_integration_change === true);
    return yield* savePbiContent(
      project,
      before,
      {
        ...sources,
        ...(title !== before.draft.title && { title }),
        ...(integration && { pbi_integration_change: draft.integration || undefined }),
      },
      draft.body,
    );
  });
}

export function savePbiReferences(
  project: ProjectId,
  before: BacklogEdit,
  references: readonly string[],
) {
  if (!isReferenceList(references)) return Effect.fail(new BacklogError({ reason: "sources" }));
  return savePbiContent(project, before, {
    pbi_references: references.length ? references : undefined,
  });
}
