import { Effect } from "effect";
import { isKnowledgeId, knowledgeType } from "../../domain/knowledge";
import type { KnowledgeId } from "../../domain/knowledge";
import { NoteNotFoundError, NoteStore, openNote } from "../notes";
import type { ProjectId } from "../projects";
import { knowledgeRecord, knowledgeSnapshot, projectKnowledge } from "./library";

export function knowledgeNoteOptions(projectId: ProjectId) {
  return Effect.map(knowledgeSnapshot, ({ records }) => projectKnowledge(projectId, records));
}

export function resolveKnowledgeNote(projectId: ProjectId, id: KnowledgeId) {
  return Effect.gen(function* () {
    const records = yield* knowledgeNoteOptions(projectId);
    const candidate = records.find((record) => record.id === id);
    if (!candidate) return;
    const store = yield* NoteStore;
    const note = yield* store
      .readFresh(candidate.path)
      .pipe(Effect.catchTag("NoteNotFoundError", () => Effect.succeed(undefined)));
    if (!note) return;
    const current = knowledgeRecord(knowledgeType.decode(note));
    return current?.id === id && current.projectId === projectId ? current : undefined;
  });
}

export function openKnowledgeNote(projectId: ProjectId, recordId: string) {
  return Effect.gen(function* () {
    if (!isKnowledgeId(recordId)) return yield* new NoteNotFoundError();
    const current = yield* resolveKnowledgeNote(projectId, recordId);
    if (!current) return yield* new NoteNotFoundError();
    yield* openNote(current.path);
  });
}
