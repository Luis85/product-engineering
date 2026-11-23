import { Effect, Stream } from "effect";
import { isKnowledgeId, knowledgeExcerpt, knowledgeType } from "../../domain/knowledge";
import type { KnowledgeId, KnowledgeValues } from "../../domain/knowledge";
import type { Note } from "../notes";
import { NoteStore, noteChanges, noteSnapshot } from "../notes";
import type { ProjectId } from "../projects";
import { EventBus } from "../shell";

export type KnowledgeRecord = {
  readonly id: KnowledgeId;
  readonly projectId: ProjectId;
  readonly kind: string;
  readonly title: string;
  readonly path: string;
  readonly displayId: string;
  readonly values: KnowledgeValues;
};

type Decoded = ReturnType<typeof knowledgeType.decode<Note["frontmatter"]>>;

export function knowledgeRecord(note: Decoded): KnowledgeRecord | undefined {
  if (note.kind === "not-this-type" || !isKnowledgeId(note.id)) return;
  if (note.kind === "read-only" && note.issue.code === "id.duplicate") return;
  const { project_id: projectId, title, kind, display_id: displayId } = note.values;
  if (!projectId || !title || !kind) return;
  return {
    id: note.id,
    projectId,
    title,
    kind,
    path: note.path,
    displayId: displayId || note.id,
    values: note.values,
  };
}

function projectLibrary({
  ready,
  failure,
  notes,
}: {
  readonly ready: boolean;
  readonly failure: unknown;
  readonly notes: readonly Decoded[];
}) {
  return {
    ready,
    failed: failure !== undefined,
    records: notes.flatMap((note) => {
      const record = knowledgeRecord(note);
      return record ? [record] : [];
    }),
  };
}

export const knowledgeSnapshot = Effect.map(noteSnapshot(knowledgeType), projectLibrary);
export const knowledgeChanges = Stream.map(noteChanges(knowledgeType), projectLibrary);
export const knowledgeBodySnapshot = Effect.succeed<{ readonly path: string } | undefined>(
  undefined,
);
export const knowledgeBodyChanges = Stream.unwrap(
  EventBus.use(({ subscribe }) =>
    Effect.map(subscribe, (events) =>
      events.pipe(
        Stream.filter((event) => event._tag === "FileModified" || event._tag === "MetadataChanged"),
        Stream.filter(({ extension }) => extension.toLowerCase() === "md"),
        Stream.map(({ path }) => ({ path })),
      ),
    ),
  ),
);

export function projectKnowledge(projectId: ProjectId, records: readonly KnowledgeRecord[]) {
  return records.filter((note) => note.projectId === projectId);
}

export function knowledgeExcerpts(records: readonly KnowledgeRecord[]) {
  return NoteStore.use((store) =>
    Effect.map(
      Effect.forEach(
        records,
        (record) =>
          Effect.match(store.readContent(record.path), {
            onFailure: () => [record.id, ""] as const,
            onSuccess: (note) => {
              const current = knowledgeRecord(knowledgeType.decode(note));
              return [
                record.id,
                current?.id === record.id && current.projectId === record.projectId
                  ? knowledgeExcerpt(note.body)
                  : "",
              ] as const;
            },
          }),
        { concurrency: 4 },
      ),
      (excerpts) => new Map(excerpts),
    ),
  );
}
