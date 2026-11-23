import type { EntityEdge, KnowledgeId } from "../../domain/knowledge";
import type { KnowledgeRecord } from "../knowledge";

export type DomainEdge = Omit<EntityEdge, "movedFrom"> & { readonly source: KnowledgeId };

function edgeKey(edge: DomainEdge) {
  const { id, source, target, verb, sourceCardinality, targetCardinality, rule } = edge;
  return [id, source, target, verb, sourceCardinality, targetCardinality, rule].join("\u0000");
}

export function sameEdge(first: DomainEdge, second: DomainEdge) {
  return edgeKey(first) === edgeKey(second);
}

export function normalizedName(value: string) {
  return value.normalize("NFC").trim().replace(/\s+/g, " ").toLowerCase();
}

export function edgeCopies<Note extends KnowledgeRecord>(notes: readonly Note[]) {
  const byId = new Map<string, { note: Note; edge: DomainEdge; movedFrom?: KnowledgeId }[]>();
  for (const note of notes) {
    for (const { movedFrom, ...edge } of note.values.domain_edges ?? []) {
      const copies = byId.get(edge.id) ?? [];
      copies.push({ note, edge: { ...edge, source: note.id }, ...(movedFrom && { movedFrom }) });
      byId.set(edge.id, copies);
    }
  }
  return byId;
}

type Copy = { note: KnowledgeRecord; readonly movedFrom?: KnowledgeId };

export function edgeOwner<EdgeCopy extends Copy>(copies: readonly EdgeCopy[]) {
  const [first, second] = copies;
  if (copies.length === 1) return first;
  if (copies.length !== 2 || !first || !second || first.note.id === second.note.id) return;
  if (first.movedFrom === second.note.id && second.movedFrom !== first.note.id) return second;
  if (second.movedFrom === first.note.id && first.movedFrom !== second.note.id) return first;
}

export function domainEdges(notes: readonly KnowledgeRecord[]) {
  return [...edgeCopies(notes).values()]
    .flatMap((copies) => {
      const current = edgeOwner(copies);
      return current ? [current.edge] : [];
    })
    .toSorted((first, second) => first.id.localeCompare(second.id));
}
