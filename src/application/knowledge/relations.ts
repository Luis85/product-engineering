import { Effect } from "effect";
import { isKnowledgeId, knowledgeType } from "../../domain/knowledge";
import type { KnowledgeId } from "../../domain/knowledge";
import { NoteStore } from "../notes";
import type { Note } from "../notes";
import type { ProjectId } from "../projects";
import { KnowledgeCreateError } from "./errors";
import { knowledgeRecord } from "./library";

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
