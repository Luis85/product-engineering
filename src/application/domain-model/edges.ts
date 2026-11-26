import { Effect, Result } from "effect";
import { knowledgeType } from "../../domain/knowledge";
import type { EntityEdge, KnowledgeId } from "../../domain/knowledge";
import type { KnowledgeNote } from "../knowledge";
import { IdGenerator } from "../notes";
import type { ProjectId } from "../projects";
import {
  DomainWrites,
  activeEntity,
  freshDomainEntities,
  readDomainEntity,
  writeEntityFields,
} from "./entities";
import { DomainModelError } from "./errors";
import { domainEdges, edgeCopies, edgeOwner, normalizedName, sameEdge } from "./graph";
import type { DomainEdge } from "./graph";

export const newDomainEdgeId = IdGenerator.use(({ nextId }) =>
  Effect.map(nextId, (uuid) => `REL-${uuid}`),
);

function storedEdge(draft: DomainEdge, movedFrom?: KnowledgeId): EntityEdge {
  const { id, target, sourceCardinality, targetCardinality } = draft;
  const rule = draft.rule?.trim();
  return {
    id,
    target,
    verb: draft.verb.trim(),
    sourceCardinality,
    targetCardinality,
    ...(rule && { rule }),
    ...(movedFrom && { movedFrom }),
  };
}

function replaceEdge(note: KnowledgeNote, id: string, next?: EntityEdge, retire = false) {
  const previous = note.values.domain_edges ?? [];
  const index = previous.findIndex((edge) => edge.id === id);
  const raw = note.frontmatter.domain_edges;
  // The codec checked the entries. Keep the unedited properties and their YAML key order.
  const edges = Array.isArray(raw) ? (raw as readonly EntityEdge[]).slice() : [];
  if (index < 0) {
    if (next) edges.push(next);
  } else {
    edges.splice(index, 1, ...(next ? [next] : []));
  }
  return writeEntityFields(note, {
    domain_edges: edges,
    ...(retire && { domain_retired_edges: [...(note.values.domain_retired_edges ?? []), id] }),
  });
}

function duplicateEdge(edges: readonly DomainEdge[], draft: DomainEdge) {
  const name = normalizedName(draft.verb);
  return edges.some(
    (edge) =>
      edge.id !== draft.id &&
      edge.source === draft.source &&
      edge.target === draft.target &&
      normalizedName(edge.verb) === name,
  );
}

function isExpectedEdge(
  edge: DomainEdge | undefined,
  base: DomainEdge | undefined,
  copyCount: number,
) {
  return edge ? base !== undefined && sameEdge(edge, base) : base === undefined && copyCount === 0;
}

function verifyEdge(notes: readonly KnowledgeNote[], draft: DomainEdge, base?: DomainEdge) {
  return Effect.gen(function* () {
    const copies = edgeCopies(notes).get(draft.id) ?? [];
    const owner = edgeOwner(copies);
    const expected = isExpectedEdge(owner?.edge, base, copies.length);
    // Only an editor with the current base may explicitly abandon a staged transfer.
    const pending = copies.find((copy) => expected && copy !== owner);
    if (owner && sameEdge(owner.edge, draft)) {
      return { owner, pending, unchanged: true };
    }
    if (!expected) {
      return yield* new DomainModelError({ reason: "changed" });
    }
    if (owner) yield* activeEntity(notes, owner.note.id);
    if (notes.some(({ values }) => values.domain_retired_edges?.includes(draft.id))) {
      return yield* new DomainModelError({ reason: "edge" });
    }
    if (duplicateEdge(domainEdges(notes), draft))
      return yield* new DomainModelError({ reason: "duplicate" });
    return { owner, pending, unchanged: false };
  });
}

function verifyActive(note: KnowledgeNote) {
  return Effect.flatMap(readDomainEntity(note), (fresh) =>
    fresh?.editable && !fresh.values.domain_archived
      ? Effect.succeed(fresh)
      : Effect.fail(new DomainModelError({ reason: "entity" })),
  );
}

function transferEdge(
  original: KnowledgeNote,
  destination: KnowledgeNote,
  target: KnowledgeNote,
  input: DomainEdge,
  current: { readonly edge: DomainEdge; readonly movedFrom?: KnowledgeId },
  staged: boolean,
) {
  return Effect.gen(function* () {
    let source = original;
    if (current.movedFrom === destination.id) {
      yield* replaceEdge(source, input.id, storedEdge(current.edge));
      source = yield* verifyActive(source);
    }
    // Keep the original authoritative while the replacement is staged. A retry finds both copies.
    if (!staged) yield* replaceEdge(destination, input.id, storedEdge(input, source.id));
    yield* verifyActive(target);
    yield* replaceEdge(source, input.id);
  });
}

export function saveDomainEdge(project: ProjectId, draft: DomainEdge, base?: DomainEdge) {
  return DomainWrites.use((lock) =>
    lock.withPermit(
      Effect.uninterruptible(
        Effect.gen(function* () {
          const input = storedEdge(draft);
          if (Result.isFailure(knowledgeType.fields.domain_edges.check([input]))) {
            return yield* new DomainModelError({ reason: "edge" });
          }
          const normalized = { ...input, source: draft.source };
          const notes = yield* freshDomainEntities(project);
          let destination = yield* activeEntity(notes, draft.source);
          const target = yield* activeEntity(notes, draft.target);
          const { owner, pending, unchanged } = yield* verifyEdge(notes, normalized, base);
          const samePending = pending !== undefined && sameEdge(pending.edge, normalized);
          if (pending && !samePending) {
            yield* replaceEdge(pending.note, draft.id);
            if (pending.note.id === destination.id) destination = yield* verifyActive(destination);
          }
          if (unchanged) return normalized;
          if (owner && owner.note.id !== destination.id) {
            yield* transferEdge(owner.note, destination, target, normalized, owner, samePending);
          } else {
            yield* replaceEdge(destination, draft.id, input);
          }
          return normalized;
        }),
      ),
    ),
  );
}

export function deleteDomainEdge(project: ProjectId, base: DomainEdge) {
  return DomainWrites.use((lock) =>
    lock.withPermit(
      Effect.uninterruptible(
        Effect.gen(function* () {
          const notes = yield* freshDomainEntities(project);
          const copies = edgeCopies(notes).get(base.id) ?? [];
          const owner = edgeOwner(copies);
          if (!owner && notes.some(({ values }) => values.domain_retired_edges?.includes(base.id)))
            return;
          if (!owner || !sameEdge(owner.edge, base))
            return yield* new DomainModelError({ reason: "changed" });
          const original = yield* activeEntity(notes, owner.note.id);
          const pending = copies.find((copy) => copy !== owner);
          if (pending) yield* replaceEdge(pending.note, base.id);
          yield* replaceEdge(original, base.id, undefined, true);
        }),
      ),
    ),
  );
}
