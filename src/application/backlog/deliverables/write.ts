import { Effect, Result } from "effect";
import { deliverableDraftIssue, deliverableType, isDeliverableId } from "../../../domain/backlog";
import type {
  DeliverableDraft,
  DeliverableId,
  DeliverableStatus,
  DeliverableValues,
} from "../../../domain/backlog";
import type { Frontmatter, FrontmatterPatch } from "../../../domain/notes";
import { sameFrontmatterValue } from "../../../domain/notes";
import { isKnowledgeKind, resolveKnowledgeNote } from "../../knowledge";
import { editChange, recordFrontmatter } from "../../notes";
import type { NoteEditConflictError, NoteStore, NoteWriteRefusedError } from "../../notes";
import { resolveProjectMember } from "../../projects";
import type { ProjectId } from "../../projects";
import {
  decodeDeliverable,
  DeliverableError,
  findDeliverable,
  withDeliverableWrite,
  writableDeliverables,
} from "./storage";
import type { DeliverableRecord } from "./storage";

function cleanDraft(input: DeliverableDraft): DeliverableDraft {
  return { ...input, title: input.title?.trim() ?? "", outcome: input.outcome?.trim() ?? "" };
}

type Writable = Effect.Success<ReturnType<typeof writableDeliverables>>;

function create({ project, store, notes }: Writable, id: DeliverableId, draft: DeliverableDraft) {
  return Effect.gen(function* () {
    const projectId = project.id;
    const prior = findDeliverable(notes, projectId, id);
    if (
      prior &&
      Object.entries(draft).every(([key, value]) =>
        sameFrontmatterValue(prior.frontmatter[key], value),
      )
    )
      return { id, displayId: prior.displayId };
    if (notes.some((note) => note?.frontmatter.id === id))
      return yield* new DeliverableError({ reason: "identity" });
    const last = notes.reduce((max, note) => {
      const fields = note?.frontmatter;
      if (fields?.project_id !== projectId) return max;
      const raw = fields.display_id;
      if (typeof raw !== "string" || !/^DEL-[0-9]{2,}$/.test(raw)) return max;
      const number = Number(raw.slice(4));
      return Number.isSafeInteger(number + 1) ? Math.max(max, number) : max;
    }, 0);
    const displayId = "DEL-" + String(last + 1).padStart(2, "0");
    const folder = [project.folder, "Deliverables"].filter(Boolean).join("/");
    yield* store.create({
      folder,
      name: `${displayId} ${id}`,
      frontmatter: recordFrontmatter(deliverableType, id, {
        ...draft,
        display_id: displayId,
        project_id: projectId,
      }),
    });
    return { id, displayId };
  });
}

type Link = Pick<DeliverableValues, "knowledge_id" | "template">;
export const sameLink = (left: Link, right: Link) =>
  left.knowledge_id === right.knowledge_id && left.template === right.template;

function validateLink(projectId: ProjectId, link: Link, current?: DeliverableRecord) {
  return Effect.gen(function* () {
    if (!link.knowledge_id) return;
    const note = yield* resolveKnowledgeNote(projectId, link.knowledge_id).pipe(
      Effect.catchTag("NoteUnreadableError", () => Effect.succeed(undefined)),
    );
    if (
      note
        ? link.template && note.kind !== link.template
        : !current || !sameLink(link, current.values)
    )
      return yield* new DeliverableError({ reason: "link" });
  });
}

function patchedLink(current: DeliverableRecord, patch: FrontmatterPatch): Link {
  const template = patch.remove?.includes("template")
    ? undefined
    : (patch.set?.template ?? current.values.template);
  const knowledge = patch.remove?.includes("knowledge_id")
    ? undefined
    : (patch.set?.knowledge_id ?? current.values.knowledge_id);
  return {
    ...(typeof template === "string" && { template }),
    ...(typeof knowledge === "string" && {
      knowledge_id: knowledge as Link["knowledge_id"] & string,
    }),
  };
}

type UpdateError = DeliverableError | NoteEditConflictError | NoteWriteRefusedError;

export function updateDeliverable(
  store: NoteStore["Service"],
  record: DeliverableRecord,
  change: (current: DeliverableRecord) => Result.Result<FrontmatterPatch, UpdateError>,
) {
  return store.update<UpdateError>(record.path, (frontmatter) => {
    const latest = decodeDeliverable({ path: record.path, frontmatter });
    if (latest?.id !== record.id || latest.projectId !== record.projectId)
      return Result.fail(new DeliverableError({ reason: "identity" }));
    return change(latest);
  });
}

function edit({ store, notes }: Writable, base: DeliverableRecord, draft: DeliverableDraft) {
  return Effect.gen(function* () {
    const { projectId, id, displayId } = base;
    const current = findDeliverable(notes, projectId, id);
    if (!current) return yield* new DeliverableError({ reason: "missing" });
    const edited: Frontmatter = {
      ...draft,
      project_id: projectId,
      display_id: displayId,
      pending_knowledge_id: base.values.pending_knowledge_id,
    };
    const apply = editChange(deliverableType, base.frontmatter, edited);
    const patch = apply(current.frontmatter);
    if (Result.isFailure(patch)) return yield* patch.failure;
    const link = patchedLink(current, patch.success);
    if (current.values.pending_knowledge_id && !sameLink(link, current.values))
      return yield* new DeliverableError({ reason: "pending" });
    yield* validateLink(projectId, link, current);
    yield* updateDeliverable(store, current, (latest) =>
      Result.flatMap(apply(latest.frontmatter), (delta) =>
        latest.values.pending_knowledge_id === current.values.pending_knowledge_id &&
        sameLink(link, patchedLink(latest, delta))
          ? Result.succeed(delta)
          : Result.fail(new DeliverableError({ reason: "link" })),
      ),
    );
    return { id, displayId };
  });
}

export function saveDeliverable(
  projectId: ProjectId,
  id: DeliverableId,
  input: DeliverableDraft,
  base?: DeliverableRecord,
) {
  return withDeliverableWrite(
    Effect.gen(function* () {
      const draft = cleanDraft(base ? input : { ...input, status: "planned" });
      const issue = saveIssue(projectId, id, draft, base);
      if (issue) return yield* new DeliverableError({ reason: issue });
      const context = yield* writableDeliverables(projectId);
      if (
        draft.owner_id &&
        draft.owner_id !== base?.values.owner_id &&
        !(yield* resolveProjectMember(projectId, draft.owner_id))
      )
        return yield* new DeliverableError({ reason: "owner" });
      if (base) return yield* edit(context, base, draft);
      yield* validateLink(projectId, draft);
      return yield* create(context, id, draft);
    }),
  );
}

function saveIssue(
  projectId: ProjectId,
  id: DeliverableId,
  draft: DeliverableDraft,
  base?: DeliverableRecord,
) {
  if (!isDeliverableId(id)) return "identity";
  if (base && (base.projectId !== projectId || base.id !== id)) return "scope";
  if (deliverableDraftIssue(draft)) return "fields";
  if (draft.template && !isKnowledgeKind(draft.template)) return "template";
}

export function setDeliverableStatus(base: DeliverableRecord, status: DeliverableStatus) {
  return withDeliverableWrite(
    Effect.gen(function* () {
      if (Result.isFailure(deliverableType.fields.status.check(status)))
        return yield* new DeliverableError({ reason: "fields" });
      const { projectId, id, frontmatter } = base;
      const { store, notes } = yield* writableDeliverables(projectId);
      const record = findDeliverable(notes, projectId, id);
      if (!record) return yield* new DeliverableError({ reason: "missing" });
      const apply = editChange(deliverableType, frontmatter, { ...base.values, status });
      yield* updateDeliverable(store, record, ({ frontmatter: current }) => apply(current));
    }),
  );
}
