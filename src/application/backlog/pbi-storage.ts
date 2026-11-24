import { Effect, Hash, Result } from "effect";
import { pbiCriteria } from "../../domain/backlog";
import { sameFrontmatterValue } from "../../domain/notes";
import type { Frontmatter } from "../../domain/notes";
import { NoteStore } from "../notes";
import type { NoteContent } from "../notes";
import type { ProjectId } from "../projects";
import type { BacklogEdit } from "./edit";
import { BacklogError } from "./model";
import { pbiSourceDraft } from "./pbi-sources";
import {
  BacklogWrites,
  frontmatterPatch,
  matchesFields,
  scopedBacklog,
  stillInBacklog,
  writableRow,
} from "./service";

export function pbiRevision(fields: Frontmatter) {
  const revision = fields.pbi_revision;
  return typeof revision === "number" && Number.isSafeInteger(revision) && revision > 0
    ? revision
    : 1;
}

export function revisePbi(fields: Frontmatter, changes: Frontmatter, bodyChanged: boolean) {
  if (
    !bodyChanged &&
    Object.keys(changes).every((key) => sameFrontmatterValue(fields[key], changes[key]))
  )
    return changes;
  return {
    ...changes,
    pbi_revision: pbiRevision(fields) + 1,
    pbi_approved_revision: undefined,
    pbi_approval_fingerprint: undefined,
  };
}

function pbiFingerprint(fields: Frontmatter, body: string, title: string) {
  const criteria = pbiCriteria(fields.pbi_criteria)?.map(
    ({ id, text, scenario_id, scenario_name, given, when, then_step }) => [
      id,
      text,
      scenario_id,
      scenario_name,
      given,
      when,
      then_step,
    ],
  );
  return Hash.string(
    JSON.stringify([
      title,
      body.replace(/\r\n|\r/g, "\n"),
      pbiSourceDraft(fields),
      criteria,
      fields.pbi_references,
      fields.pbi_integration_change === true,
    ]),
  );
}

function approvalPatch(
  { frontmatter, body }: Pick<NoteContent, "frontmatter" | "body">,
  before: BacklogEdit,
  fallback: string,
) {
  const revision = pbiRevision(frontmatter);
  const title = typeof frontmatter.title === "string" ? frontmatter.title || fallback : fallback;
  const fingerprint = pbiFingerprint(frontmatter, body, title);
  const previous = pbiFingerprint(before.item.fields, before.draft.body, before.draft.title);
  if (revision !== pbiRevision(before.item.fields) || fingerprint !== previous) {
    return Result.fail(new BacklogError({ reason: "conflict" }));
  }
  return Result.succeed({
    patch: { set: { pbi_approved_revision: revision, pbi_approval_fingerprint: fingerprint } },
  });
}

export function pbiApproval(
  fields: Frontmatter,
  body: string,
  title: string,
): "draft" | "approved" {
  const revision = pbiRevision(fields);
  return fields.pbi_approved_revision === revision &&
    fields.pbi_approval_fingerprint === pbiFingerprint(fields, body, title)
    ? "approved"
    : "draft";
}

export function savePbiContent(
  project: ProjectId,
  before: BacklogEdit,
  changes: Frontmatter,
  draft = before.draft.body,
  approve = false,
) {
  return BacklogWrites.use(({ lock, recent }) =>
    lock.withPermit(
      Effect.gen(function* () {
        const context = yield* scopedBacklog(project);
        const { row } = yield* writableRow(context, before.item.key);
        if (row.kind !== "UC" || !row.adopted)
          return yield* new BacklogError({ reason: "identity" });
        const identity = { ...before.item, path: row.path };
        const updateBody = draft !== before.draft.body;
        const store = yield* NoteStore;
        const saved = yield* store.updateContent(row.path, (current) => {
          const { frontmatter, body } = current;
          if (
            !stillInBacklog(context, identity, frontmatter) ||
            !matchesFields(frontmatter, before.item.fields, changes) ||
            (updateBody && body !== before.draft.body && body !== draft)
          )
            return Result.fail(new BacklogError({ reason: "conflict" }));
          if (approve) return approvalPatch(current, before, row.title);
          return Result.succeed({
            patch: frontmatterPatch(revisePbi(frontmatter, changes, updateBody && body !== draft)),
            ...(updateBody && { body: draft }),
          });
        });
        recent.set(saved.path, saved);
        return saved;
      }),
    ),
  );
}
