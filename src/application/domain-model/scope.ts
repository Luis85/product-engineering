import { Effect } from "effect";
import { isKnowledgeId } from "../../domain/knowledge";
import type { EntityScopeTarget, KnowledgeId } from "../../domain/knowledge";
import { knowledgeNoteOptions, resolveKnowledgeNote } from "../knowledge";
import type { KnowledgeRecord } from "../knowledge";
import type { ProjectId } from "../projects";
import { DomainWrites, freshDomainEntities, readDomainEntity, writeEntityFields } from "./entities";
import { DomainModelError } from "./errors";
import { domainEdges } from "./graph";

type ScopeOrigin = EntityScopeTarget & { readonly projectId: ProjectId; readonly title: string };
type ScopeContribution = {
  readonly source: ScopeOrigin;
  readonly origins?: readonly ScopeOrigin[];
  readonly foundationEntities?: readonly KnowledgeId[];
  readonly foundationOrigins?: readonly {
    readonly entity: KnowledgeId;
    readonly origin: ScopeOrigin;
  }[];
};

export type DomainScopeContributor<R = never> = (
  project: ProjectId,
  target: EntityScopeTarget,
) => Effect.Effect<ScopeContribution | undefined, never, R>;

function scopeKey(target: EntityScopeTarget) {
  return `${target.kind}:${target.id}`;
}

export function entityAssigned(entity: KnowledgeRecord, target: EntityScopeTarget) {
  return (entity.values.domain_scope ?? []).some((ref) => scopeKey(ref) === scopeKey(target));
}

function scopeContribution<R>(
  project: ProjectId,
  target: EntityScopeTarget,
  contribute?: DomainScopeContributor<R>,
): Effect.Effect<
  ScopeContribution | undefined,
  Effect.Error<ReturnType<typeof resolveKnowledgeNote>>,
  Effect.Services<ReturnType<typeof resolveKnowledgeNote>> | R
> {
  if (target.kind !== "prd") {
    return Effect.map(contribute?.(project, target) ?? Effect.succeed(undefined), (result) =>
      result?.source.projectId === project && scopeKey(result.source) === scopeKey(target)
        ? result
        : undefined,
    );
  }
  if (!isKnowledgeId(target.id)) return Effect.succeed(undefined);
  return Effect.map(
    resolveKnowledgeNote(project, target.id),
    (record): ScopeContribution | undefined =>
      record?.kind === "prd"
        ? { source: { ...target, projectId: project, title: record.title } }
        : undefined,
  );
}

function scopeEntity(project: ProjectId, entity: KnowledgeId, assigned: boolean) {
  return Effect.gen(function* () {
    const records = yield* knowledgeNoteOptions(project);
    const record = records.find(({ id, kind }) => id === entity && kind === "entity");
    const current = record ? yield* readDomainEntity(record) : undefined;
    if (!current?.editable || (assigned && current.values.domain_archived)) {
      return yield* new DomainModelError({ reason: "entity" });
    }
    return current;
  });
}

export function setEntityScope<R = never>(
  project: ProjectId,
  entity: KnowledgeId,
  target: EntityScopeTarget,
  assigned: boolean,
  contribute?: DomainScopeContributor<R>,
) {
  return DomainWrites.use((lock) =>
    lock.withPermit(
      Effect.gen(function* () {
        const current = yield* scopeEntity(project, entity, assigned);
        if (assigned && !(yield* scopeContribution(project, target, contribute))) {
          return yield* new DomainModelError({ reason: "scope" });
        }
        if (entityAssigned(current, target) === assigned) return;
        const before = current.values.domain_scope ?? [];
        const references = assigned
          ? [...before, { kind: target.kind, id: target.id }]
          : before.filter((ref) => scopeKey(ref) !== scopeKey(target));
        yield* writeEntityFields(current, { domain_scope: references });
      }),
    ),
  );
}

function scopeOrigins(
  project: ProjectId,
  contributions: readonly (ScopeContribution | undefined)[],
) {
  const sources = new Map<string, ScopeOrigin>();
  const foundations = new Map<KnowledgeId, Set<string>>();
  for (const contribution of contributions) {
    if (!contribution) continue;
    const key = scopeKey(contribution.source);
    sources.set(key, contribution.source);
    for (const origin of contribution.origins ?? []) {
      if (origin.projectId === project) sources.set(scopeKey(origin), origin);
    }
    addFoundations(contribution, project, sources, foundations);
  }
  return { sources, foundations };
}

function addFoundations(
  contribution: ScopeContribution,
  project: ProjectId,
  sources: ReadonlyMap<string, ScopeOrigin>,
  foundations: Map<KnowledgeId, Set<string>>,
) {
  const fromSource = (contribution.foundationEntities ?? []).map((entity) => ({
    entity,
    origin: contribution.source,
  }));
  for (const { entity, origin } of [...fromSource, ...(contribution.foundationOrigins ?? [])]) {
    const key = scopeKey(origin);
    if (origin.projectId !== project || !sources.has(key)) continue;
    const matches = foundations.get(entity) ?? new Set<string>();
    matches.add(key);
    foundations.set(entity, matches);
  }
}

function endpoint({ id, title, displayId }: KnowledgeRecord) {
  return { id, title, displayId };
}

export function resolveDomainScope<R = never>(
  project: ProjectId,
  targets: readonly EntityScopeTarget[],
  contribute?: DomainScopeContributor<R>,
) {
  return Effect.gen(function* () {
    const contributions = yield* Effect.forEach(
      targets,
      (target) => scopeContribution(project, target, contribute),
      { concurrency: 4 },
    );
    const { sources, foundations } = scopeOrigins(project, contributions);
    const notes = yield* freshDomainEntities(project);
    const active = notes.filter(({ values }) => !values.domain_archived);
    const byId = new Map(active.map((note) => [note.id, note]));
    const entities = active
      .flatMap((note) => {
        const keys = new Set(foundations.get(note.id));
        for (const reference of note.values.domain_scope ?? []) keys.add(scopeKey(reference));
        const origins = [...keys].toSorted().flatMap((key) => {
          const origin = sources.get(key);
          return origin ? [origin] : [];
        });
        return origins.length
          ? [
              {
                ...endpoint(note),
                definition: note.body,
                attributes: note.values.domain_attributes ?? [],
                origins,
              },
            ]
          : [];
      })
      .toSorted((first, second) => first.id.localeCompare(second.id));
    const matched = new Set(entities.map(({ id }) => id));
    const neighbors = new Map<KnowledgeId, ReturnType<typeof endpoint>>();
    const edges = domainEdges(notes).flatMap((edge) => {
      const from = byId.get(edge.source);
      const to = byId.get(edge.target);
      if (!from || !to || (!matched.has(edge.source) && !matched.has(edge.target))) return [];
      for (const note of [from, to]) {
        if (!matched.has(note.id)) neighbors.set(note.id, endpoint(note));
      }
      return [{ ...edge, sourceEntity: endpoint(from), targetEntity: endpoint(to) }];
    });
    return {
      entities,
      edges,
      neighbors: [...neighbors.values()].toSorted((first, second) =>
        first.id.localeCompare(second.id),
      ),
    };
  });
}
