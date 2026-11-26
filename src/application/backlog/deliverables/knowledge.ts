import { Effect, Layer, Result } from "effect";
import { isDeliverableId } from "../../../domain/backlog";
import { isKnowledgeId } from "../../../domain/knowledge";
import type { KnowledgeId } from "../../../domain/knowledge";
import {
  createKnowledge,
  KnowledgeDeliverableOrigins,
  resolveKnowledgeNote,
} from "../../knowledge";
import type { CreateKnowledgeRequest, KnowledgeDraft, KnowledgeRecord } from "../../knowledge";
import { NoteStore } from "../../notes";
import type { Note } from "../../notes";
import {
  decodeDeliverable,
  DeliverableError,
  findDeliverable,
  freshDeliverables,
  withDeliverableWrite,
  writableDeliverables,
} from "./storage";
import type { DeliverableRecord } from "./storage";
import { sameLink, updateDeliverable } from "./write";

type OriginResolver = KnowledgeDeliverableOrigins["Service"]["resolve"];
type DeliverableOrigin = Parameters<OriginResolver>[0];

function originResolver<E>(
  load: (origin: DeliverableOrigin) => Effect.Effect<DeliverableRecord | undefined, E>,
): KnowledgeDeliverableOrigins["Service"] {
  return {
    resolve: (origin, knowledge) =>
      Effect.gen(function* () {
        if (!isDeliverableId(origin.recordId)) return;
        const current = yield* load(origin);
        if (current?.id !== origin.recordId || current.projectId !== origin.projectId) return;
        if (current.values.pending_knowledge_id !== knowledge.id) return;
        if (current.values.template && current.values.template !== knowledge.template) return;
        return origin;
      }).pipe(Effect.catch(() => Effect.succeed(undefined))),
  };
}

export const deliverableOriginsLayer = Layer.effect(
  KnowledgeDeliverableOrigins,
  Effect.map(NoteStore, (store) =>
    originResolver((origin) =>
      Effect.map(freshDeliverables(store), (notes) =>
        findDeliverable(notes, origin.projectId, origin.recordId),
      ),
    ),
  ),
);

function validProof(record: DeliverableRecord, proof: KnowledgeRecord | undefined) {
  return (
    proof?.projectId === record.projectId &&
    proof.values.deliverable_id === record.id &&
    (!record.values.template || record.values.template === proof.kind)
  );
}

export function deliverableNote(record: DeliverableRecord, knowledge: readonly KnowledgeRecord[]) {
  const pending = knowledge.find(({ id }) => id === record.values.pending_knowledge_id);
  if (pending && validProof(record, pending)) return pending;
  return knowledge.find(
    ({ id, projectId }) => id === record.values.knowledge_id && projectId === record.projectId,
  );
}

export function deliverableBacklinks(
  note: KnowledgeRecord,
  records: readonly DeliverableRecord[],
  knowledge: readonly KnowledgeRecord[],
) {
  return records.filter(
    (record) =>
      record.projectId === note.projectId && deliverableNote(record, knowledge)?.id === note.id,
  );
}

function reserve(store: NoteStore["Service"], current: DeliverableRecord, id: KnowledgeId) {
  return updateDeliverable(store, current, (latest) =>
    sameLink(latest.values, current.values) &&
    latest.values.pending_knowledge_id === current.values.pending_knowledge_id
      ? Result.succeed({ set: { pending_knowledge_id: id } })
      : Result.fail(new DeliverableError({ reason: "pending" })),
  );
}

function finish(store: NoteStore["Service"], current: DeliverableRecord, id: KnowledgeId) {
  return updateDeliverable(store, current, (latest) =>
    latest.values.pending_knowledge_id === id && sameLink(latest.values, current.values)
      ? Result.succeed({ set: { knowledge_id: id }, remove: ["pending_knowledge_id"] })
      : Result.fail(new DeliverableError({ reason: "pending" })),
  );
}

function verifyPrepared(
  note: Note,
  record: DeliverableRecord,
  id: KnowledgeId,
  draft: KnowledgeDraft,
) {
  const { frontmatter } = note;
  return (
    frontmatter.id === id &&
    frontmatter.project_id === record.projectId &&
    frontmatter.deliverable_id === record.id &&
    frontmatter.kind === draft.kind
  );
}

function requestIssue(base: DeliverableRecord, request: CreateKnowledgeRequest) {
  const { id, projectId } = base;
  const origin = request.origin;
  if (
    request.projectId !== projectId ||
    origin?.kind !== "deliverable" ||
    origin.recordId !== id ||
    origin.projectId !== projectId
  )
    return "scope";
  if (!isKnowledgeId(request.id)) return "identity";
}

function attachedProof(
  store: NoteStore["Service"],
  record: DeliverableRecord,
  operation: KnowledgeId,
) {
  return Effect.gen(function* () {
    const linked = record.values.knowledge_id;
    if (!linked) return;
    const note = yield* resolveKnowledgeNote(record.projectId, linked).pipe(
      Effect.catchTag("NoteUnreadableError", () => Effect.succeed(undefined)),
    );
    if (!note) return;
    if (linked !== operation || !validProof(record, note))
      return yield* new DeliverableError({ reason: "pending" });
    return yield* store.readFresh(note.path);
  });
}

function issuePreparedNote(
  store: NoteStore["Service"],
  current: DeliverableRecord,
  request: CreateKnowledgeRequest,
  draft: KnowledgeDraft,
) {
  return Effect.gen(function* () {
    const { id } = request;
    if (!current.values.pending_knowledge_id) yield* reserve(store, current, id);
    // Obsidian refreshes cached frontmatter asynchronously after its atomic write.
    const scopedOrigin = originResolver(() =>
      Effect.map(store.readFresh(current.path), decodeDeliverable),
    );
    const inserted = yield* Effect.provideService(
      createKnowledge(request, draft),
      KnowledgeDeliverableOrigins,
      scopedOrigin,
    );
    const note = yield* store.readFresh(inserted.path);
    if (!verifyPrepared(note, current, id, draft))
      return yield* new DeliverableError({ reason: "pending" });
    yield* finish(store, current, id);
    return note;
  });
}

export function prepareDeliverableNote(
  base: DeliverableRecord,
  request: CreateKnowledgeRequest,
  draft: KnowledgeDraft,
) {
  return withDeliverableWrite(
    Effect.gen(function* () {
      const issue = requestIssue(base, request);
      if (issue) return yield* new DeliverableError({ reason: issue });
      const { store, notes } = yield* writableDeliverables(base.projectId);
      const current = findDeliverable(notes, base.projectId, base.id);
      if (!current) return yield* new DeliverableError({ reason: "missing" });
      if (current.values.template && current.values.template !== draft.kind)
        return yield* new DeliverableError({ reason: "template" });
      const id =
        current.values.pending_knowledge_id ?? base.values.pending_knowledge_id ?? request.id;
      const prior = yield* attachedProof(store, current, id);
      if (prior) return prior;
      if (!sameLink(current.values, base.values))
        return yield* new DeliverableError({ reason: "pending" });
      return yield* issuePreparedNote(store, current, { ...request, id }, draft);
    }),
  );
}
