import { Effect } from "effect";
import { isKnowledgeId } from "../../domain/knowledge";
import type { KnowledgeId } from "../../domain/knowledge";
import { storyMapFoundationDraft } from "../../domain/story-maps";
import { readKnowledgeNote, resolveKnowledgeNote } from "../knowledge";
import type { KnowledgeRecord } from "../knowledge";
import { NoteStore } from "../notes";
import type { ProjectId } from "../projects";
import { StoryMapError } from "./errors";

function freshKnowledge(projectId: ProjectId, id: KnowledgeId, kind: string) {
  return resolveKnowledgeNote(projectId, id).pipe(
    Effect.catchTag("NoteUnreadableError", () => Effect.succeed(undefined)),
    Effect.map((record) => (record?.kind === kind ? record : undefined)),
  );
}

function readScopedFoundation(projectId: ProjectId, id: KnowledgeId, path: string, kind: string) {
  return readKnowledgeNote(projectId, id, path).pipe(
    Effect.catchTag(["NoteNotFoundError", "NoteUnreadableError"], () => Effect.succeed(undefined)),
    Effect.map((note) => (note?.kind === kind ? note : undefined)),
  );
}

function resolvePrd(projectId: ProjectId, id: KnowledgeId, path: string | undefined) {
  return Effect.gen(function* () {
    const indexed = yield* freshKnowledge(projectId, id, "prd");
    if (indexed) return indexed;
    // The native note view can open a just-created PRD before its metadata is indexed.
    const store = yield* NoteStore;
    const candidates = (yield* store.sources).filter(({ frontmatter }) => frontmatter.id === id);
    const current = candidates.length ? candidates.length === 1 && candidates[0]?.path : path;
    if (current) return yield* readScopedFoundation(projectId, id, current, "prd");
  });
}

export function storyMapFoundations(projectId: ProjectId, prdId: KnowledgeId, path?: string) {
  return Effect.gen(function* () {
    if (!isKnowledgeId(prdId)) return yield* new StoryMapError({ reason: "source" });
    const prd = yield* resolvePrd(projectId, prdId, path);
    if (!prd) return yield* new StoryMapError({ reason: "source" });
    const { vision_id: visionId, job_ids: jobIds } = prd.values;
    const [vision, candidates] = yield* Effect.all(
      [
        visionId ? freshKnowledge(projectId, visionId, "vision") : Effect.succeed(undefined),
        Effect.forEach(new Set(jobIds), (id) => freshKnowledge(projectId, id, "jtbd"), {
          concurrency: 4,
        }),
      ],
      { concurrency: 2 },
    );
    const jobs = candidates
      .filter((record) => record !== undefined)
      .toSorted((a, b) => a.displayId.localeCompare(b.displayId) || a.id.localeCompare(b.id));
    return { prd, vision, jobs };
  });
}

function readFoundation(record: KnowledgeRecord | undefined) {
  if (!record) return Effect.succeed(undefined);
  return readScopedFoundation(record.projectId, record.id, record.path, record.kind);
}

export function storyMapPrefill(projectId: ProjectId, prdId: KnowledgeId, path?: string) {
  return Effect.gen(function* () {
    const { prd, vision, jobs } = yield* storyMapFoundations(projectId, prdId, path);
    const [source, productVision, soleJob] = yield* Effect.all(
      [
        readFoundation(prd),
        readFoundation(vision),
        readFoundation(jobs.length === 1 ? jobs[0] : undefined),
      ],
      { concurrency: 3 },
    );
    if (!source) return yield* new StoryMapError({ reason: "source" });
    return {
      source: { title: source.title, displayId: source.displayId },
      draft: storyMapFoundationDraft(source.title, source.body, productVision?.body, soleJob?.body),
    };
  });
}
