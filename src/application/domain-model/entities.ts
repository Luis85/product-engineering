import { Context, Effect, Layer, Result, Semaphore } from "effect";
import { knowledgeType } from "../../domain/knowledge";
import type { KnowledgeId, KnowledgeValues } from "../../domain/knowledge";
import type { FrontmatterPatch } from "../../domain/notes";
import { knowledgeNoteOptions, projectKnowledge, readKnowledgeNote } from "../knowledge";
import type { KnowledgeNote, KnowledgeRecord } from "../knowledge";
import { NoteStore, editChange } from "../notes";
import type { NoteEditConflictError, NoteWriteRefusedError } from "../notes";
import type { ProjectId } from "../projects";
import { DomainModelError } from "./errors";

export class DomainWrites extends Context.Service<DomainWrites, Semaphore.Semaphore>()(
  "product-engineering/application/DomainWrites",
) {}

export const domainWritesLayer = Layer.effect(DomainWrites, Semaphore.make(1));

export function entityRecords(project: ProjectId, records: readonly KnowledgeRecord[]) {
  return projectKnowledge(project, records).filter(({ kind }) => kind === "entity");
}

export function readDomainEntity(record: KnowledgeRecord) {
  return readKnowledgeNote(record.projectId, record.id, record.path).pipe(
    Effect.map((note) => (note.kind === "entity" ? note : undefined)),
    Effect.catchTags({
      NoteNotFoundError: () => Effect.succeed(undefined),
      NoteUnreadableError: () => Effect.succeed(undefined),
    }),
  );
}

export function freshDomainEntities(project: ProjectId) {
  return Effect.gen(function* () {
    const records = yield* knowledgeNoteOptions(project);
    const fresh = yield* Effect.forEach(entityRecords(project, records), readDomainEntity, {
      concurrency: 4,
    });
    return fresh.filter((note) => note !== undefined);
  });
}

export function activeEntity(records: readonly KnowledgeNote[], id: KnowledgeId) {
  const note = records.find((record) => record.id === id && !record.values.domain_archived);
  return note?.editable
    ? Effect.succeed(note)
    : Effect.fail(new DomainModelError({ reason: "entity" }));
}

type EntityFields = Pick<
  KnowledgeValues,
  "domain_edges" | "domain_retired_edges" | "domain_archived" | "domain_scope"
>;

function invalidateScopeApproval(patch: FrontmatterPatch): FrontmatterPatch {
  const { set } = patch;
  if (!set || !Object.hasOwn(set, "domain_scope")) return patch;
  return { ...patch, set: { ...set, approval: "draft" } };
}

export function writeEntityFields(base: KnowledgeNote, fields: EntityFields) {
  const merge = editChange(knowledgeType, base.frontmatter, { ...base.frontmatter, ...fields });
  return NoteStore.use((store) =>
    store.update<DomainModelError | NoteEditConflictError | NoteWriteRefusedError>(
      base.path,
      (current) => {
        const { values, issues } = knowledgeType.check(current);
        if (
          values.project_id !== base.projectId ||
          values.kind !== "entity" ||
          !values.title ||
          Boolean(values.domain_archived) !== Boolean(base.values.domain_archived) ||
          issues.some(({ key }) => Object.hasOwn(fields, key))
        ) {
          return Result.fail(new DomainModelError({ reason: "changed" }));
        }
        return Result.map(merge(current), invalidateScopeApproval);
      },
    ),
  );
}

export function setEntityArchived(base: KnowledgeNote, archived: boolean) {
  return DomainWrites.use((lock) =>
    lock.withPermit(
      Effect.gen(function* () {
        const current = yield* readDomainEntity(base);
        if (!current?.editable) return yield* new DomainModelError({ reason: "changed" });
        if (Boolean(current.values.domain_archived) === archived) return;
        if (Boolean(current.values.domain_archived) !== Boolean(base.values.domain_archived)) {
          return yield* new DomainModelError({ reason: "changed" });
        }
        yield* writeEntityFields(current, { domain_archived: archived });
      }),
    ),
  );
}
