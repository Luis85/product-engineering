import { Context, Effect, Layer, Result, Semaphore } from "effect";
import { checkedEntityAttributes, isKnowledgeId, knowledgeType } from "../../domain/knowledge";
import type { EntityAttribute, KnowledgeId } from "../../domain/knowledge";
import { fitsFileName, recordFileName, recordId } from "../../domain/notes";
import { isProjectMemberId } from "../../domain/projects";
import { IdGenerator, NoteStore, recordFrontmatter } from "../notes";
import type { Note } from "../notes";
import { readFreshProject, resolveProjectMember } from "../projects";
import type { ProjectId, ProjectSettings } from "../projects";
import { Messages } from "../shell";
import { KnowledgeCreateError } from "./errors";
import { isKnowledgeKind } from "./kinds";
import type { KnowledgeKind } from "./kinds";
import { knowledgeRecord } from "./library";
import { verifyKnowledgeOrigin } from "./origins";
import type { KnowledgeOrigin } from "./origins";
import { validateFoundations } from "./relations";
import { knowledgePrefixes, knowledgeTemplateBody } from "./templates";

export type KnowledgeDraft = {
  readonly kind: KnowledgeKind;
  readonly title: string;
  readonly actor_type: string;
  readonly owner_id: string;
  readonly vision_id: string;
  readonly job_ids: readonly string[];
  readonly entity?: {
    readonly definition: string;
    readonly attributes: readonly EntityAttribute[];
  };
};

export type CreateKnowledgeRequest = {
  readonly projectId: ProjectId;
  readonly id: KnowledgeId;
  readonly origin?: KnowledgeOrigin;
};

class KnowledgeWrites extends Context.Service<
  KnowledgeWrites,
  {
    readonly lock: Semaphore.Semaphore;
    readonly recent: Map<KnowledgeId, Note>;
  }
>()("product-engineering/application/KnowledgeWrites") {}

export const knowledgeWritesLayer = Layer.effect(
  KnowledgeWrites,
  Effect.map(Semaphore.make(1), (lock) => ({ lock, recent: new Map() })),
);

export const newKnowledgeId = IdGenerator.use(({ nextId }) =>
  Effect.map(nextId, (uuid) => {
    const id = recordId(knowledgeType.type, uuid);
    if (!isKnowledgeId(id)) throw new Error("The host generated an invalid Knowledge ID");
    return id;
  }),
);

function usedIds(notes: readonly Note[], projectId: ProjectId) {
  const displayIds = new Set<string>();
  const requirements = new Set<string>();
  for (const note of notes) {
    const record = knowledgeRecord(knowledgeType.decode(note));
    if (record?.projectId !== projectId) continue;
    displayIds.add(record.displayId.toUpperCase());
    if (record.values.requirement_id) requirements.add(record.values.requirement_id.toUpperCase());
  }
  return { displayIds, requirements };
}

function allocateShortIds(notes: readonly Note[], projectId: ProjectId, kind: KnowledgeKind) {
  const prefix = knowledgePrefixes[kind];
  const { displayIds, requirements } = usedIds(notes, projectId);
  for (let next = 1; next <= displayIds.size + requirements.size + 1; next += 1) {
    const suffix = String(next).padStart(2, "0");
    const displayId = `${prefix}-${suffix}`;
    const requirementId = kind === "prd" ? `REQ-${suffix}` : undefined;
    if (!displayIds.has(displayId) && (!requirementId || !requirements.has(requirementId))) {
      return { displayId, requirementId };
    }
  }
  throw new Error("Could not allocate a Knowledge display ID");
}

function existingNote(notes: readonly Note[], request: CreateKnowledgeRequest) {
  const matches = notes.filter(({ frontmatter }) => frontmatter.id === request.id);
  if (!matches.length) return Effect.succeed(undefined);
  const note = matches.length === 1 ? matches[0] : undefined;
  if (note && knowledgeRecord(knowledgeType.decode(note))?.projectId === request.projectId) {
    return Effect.succeed(note);
  }
  return Effect.fail(new KnowledgeCreateError({ reason: "identity" }));
}

function checkedDraft(draft: KnowledgeDraft) {
  return Effect.gen(function* () {
    const { kind } = draft;
    if (!isKnowledgeKind(kind)) return yield* new KnowledgeCreateError({ reason: "template" });
    const title = draft.title.trim();
    if (
      !title ||
      Result.isFailure(knowledgeType.fields.title.check(title)) ||
      !fitsFileName(title, knowledgePrefixes[kind])
    ) {
      return yield* new KnowledgeCreateError({ reason: "title" });
    }
    if (kind !== "actor") return { title, kind };
    const actor = knowledgeType.fields.actor_type.check(draft.actor_type);
    if (Result.isFailure(actor) || !actor.success) {
      return yield* new KnowledgeCreateError({ reason: "actor_type" });
    }
    return { title, kind, actor: actor.success };
  });
}

function checkedOwner(projectId: ProjectId, owner: string) {
  return Effect.gen(function* () {
    if (!owner) return;
    if (isProjectMemberId(owner) && (yield* resolveProjectMember(projectId, owner))) return owner;
    return yield* new KnowledgeCreateError({ reason: "owner_id" });
  });
}

function noteName(title: string, displayId: string) {
  const name = recordFileName(title, displayId);
  return /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name) ? displayId : name;
}

function currentKnowledgeNotes(current: readonly Note[], recent: Map<KnowledgeId, Note>) {
  // Obsidian registers a created file in the index after its metadata callback.
  for (const note of current) {
    const id = note.frontmatter.id;
    if (isKnowledgeId(id)) recent.delete(id);
  }
  return [...current, ...recent.values()];
}

function draftContent(kind: KnowledgeKind, draft: KnowledgeDraft, requirementId?: string) {
  return Effect.gen(function* () {
    if (kind === "entity" && draft.entity) {
      const attributes = checkedEntityAttributes(draft.entity.attributes);
      if (Result.isFailure(attributes)) {
        return yield* new KnowledgeCreateError({ reason: "attributes" });
      }
      return { body: draft.entity.definition, fields: { domain_attributes: attributes.success } };
    }
    const { knowledge } = yield* Messages;
    return { body: knowledgeTemplateBody(knowledge.headings, kind, requirementId), fields: {} };
  });
}

function createInProject(
  request: CreateKnowledgeRequest,
  draft: KnowledgeDraft,
  project: ProjectSettings,
  recent: Map<KnowledgeId, Note>,
) {
  return Effect.gen(function* () {
    const { projectId, id, origin } = request;
    const { kind, title, actor } = yield* checkedDraft(draft);
    const owner = yield* checkedOwner(projectId, draft.owner_id);
    const store = yield* NoteStore;
    const current = yield* store.list;
    const notes = currentKnowledgeNotes(current, recent);
    const source = yield* verifyKnowledgeOrigin(projectId, id, kind, origin, notes);
    const prior = yield* existingNote(notes, request);
    if (prior) return prior;
    const foundations =
      kind === "prd"
        ? yield* validateFoundations(projectId, notes, source.vision_id ?? draft.vision_id, [
            ...(source.job_ids ?? []),
            ...draft.job_ids,
          ])
        : undefined;
    const { displayId, requirementId } = allocateShortIds(notes, projectId, kind);
    const { body, fields } = yield* draftContent(kind, draft, requirementId);
    const note = yield* store.create({
      folder: project.folder,
      name: noteName(title, displayId),
      frontmatter: recordFrontmatter(knowledgeType, id, {
        project_id: projectId,
        kind,
        title,
        display_id: displayId,
        approval: "draft",
        owner_id: owner,
        actor_type: actor,
        requirement_id: requirementId,
        ...fields,
        ...source,
        ...foundations,
      }),
      body,
    });
    recent.set(id, note);
    return note;
  });
}

export function createKnowledge(request: CreateKnowledgeRequest, draft: KnowledgeDraft) {
  return KnowledgeWrites.use(({ lock, recent }) =>
    lock.withPermit(
      Effect.uninterruptible(
        Effect.gen(function* () {
          const { projectId, id } = request;
          if (!isKnowledgeId(id)) return yield* new KnowledgeCreateError({ reason: "identity" });
          const project = yield* readFreshProject(projectId);
          if (!project) return yield* new KnowledgeCreateError({ reason: "project" });
          return yield* createInProject(request, draft, project, recent);
        }),
      ),
    ),
  );
}
