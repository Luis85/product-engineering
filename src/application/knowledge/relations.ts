import { Effect } from "effect";
import { isKnowledgeId, knowledgeType } from "../../domain/knowledge";
import type { KnowledgeId } from "../../domain/knowledge";
import { NoteStore } from "../notes";
import type { Note } from "../notes";
import type { ProjectId } from "../projects";
import { KnowledgeCreateError } from "./errors";
import { knowledgeRecord, projectKnowledge } from "./library";
import type { KnowledgeRecord } from "./library";

function relationIds({ values }: KnowledgeRecord) {
  return new Set([values.vision_id, ...(values.job_ids ?? [])]);
}

export function knowledgeRelationships(
  current: KnowledgeRecord,
  records: readonly KnowledgeRecord[],
) {
  const scoped = projectKnowledge(current.projectId, records)
    .filter(({ id }) => id !== current.id)
    .toSorted((a, b) => a.displayId.localeCompare(b.displayId) || a.id.localeCompare(b.id));
  const ids = relationIds(current);
  const sources = scoped.filter((record) =>
    record.kind === "vision"
      ? current.values.vision_id === record.id
      : record.kind === "jtbd" && ids.has(record.id),
  );
  const backlinks = scoped.filter((record) => {
    if (current.kind === "vision")
      return record.kind === "prd" && record.values.vision_id === current.id;
    return (
      current.kind === "jtbd" &&
      ["vision", "research", "prd"].includes(record.kind) &&
      record.values.job_ids?.includes(current.id)
    );
  });
  const visions =
    current.kind === "jtbd"
      ? scoped.filter(
          (record) => record.kind === "vision" && !backlinks.some(({ id }) => id === record.id),
        )
      : [];
  return { sources, backlinks, visions };
}

export function currentKnowledgeTarget(
  projectId: ProjectId,
  recordId: KnowledgeId,
  kind: string,
  notes: readonly Note[],
) {
  return Effect.gen(function* () {
    const matches = notes.filter(({ frontmatter }) => frontmatter.id === recordId);
    const path = matches.length === 1 ? matches[0]?.path : undefined;
    if (!path) return;
    const store = yield* NoteStore;
    const note = yield* store.readFresh(path).pipe(
      Effect.catchTag("NoteNotFoundError", () => Effect.succeed(undefined)),
      Effect.catchTag("NoteUnreadableError", () => Effect.succeed(undefined)),
    );
    if (!note) return;
    const record = knowledgeRecord(knowledgeType.decode(note));
    return record?.id === recordId && record.projectId === projectId && record.kind === kind
      ? record
      : undefined;
  });
}

function requireTarget(
  projectId: ProjectId,
  notes: readonly Note[],
  id: string,
  kind: string,
  reason: "vision_id" | "job_ids",
) {
  return Effect.gen(function* () {
    if (isKnowledgeId(id) && (yield* currentKnowledgeTarget(projectId, id, kind, notes))) return id;
    return yield* new KnowledgeCreateError({ reason });
  });
}

export function validateFoundations(
  projectId: ProjectId,
  notes: readonly Note[],
  vision: string,
  jobs: readonly string[],
) {
  return Effect.gen(function* () {
    const visionId = vision
      ? yield* requireTarget(projectId, notes, vision, "vision", "vision_id")
      : undefined;
    const jobIds = yield* Effect.forEach(new Set(jobs), (id) =>
      requireTarget(projectId, notes, id, "jtbd", "job_ids"),
    );
    return { vision_id: visionId, job_ids: jobIds.length ? jobIds : undefined };
  });
}
