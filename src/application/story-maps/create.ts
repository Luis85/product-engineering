import { Context, Effect, Layer, Semaphore } from "effect";
import type { KnowledgeId } from "../../domain/knowledge";
import { recordId } from "../../domain/notes";
import {
  isStoryMapId,
  storyMapFields,
  storyMapFieldInvalid,
  storyMapType,
} from "../../domain/story-maps";
import type { StoryMapDraft, StoryMapId } from "../../domain/story-maps";
import { IdGenerator, NoteStore, recordFolder, recordFrontmatter } from "../notes";
import type { Note } from "../notes";
import { readFreshProject } from "../projects";
import type { ProjectId, ProjectSettings } from "../projects";
import { StoryMapError } from "./errors";
import { storyMapFoundations } from "./foundations";
import { decodeStoryMap } from "./records";

type StoryMapCreation = {
  readonly projectId: ProjectId;
  readonly id: StoryMapId;
  readonly prdId?: KnowledgeId;
  readonly sourcePath?: string;
};

class StoryMapWrites extends Context.Service<
  StoryMapWrites,
  { readonly lock: Semaphore.Semaphore; readonly recent: Set<string> }
>()("product-engineering/application/StoryMapWrites") {}

export const storyMapWritesLayer = Layer.effect(
  StoryMapWrites,
  Effect.map(Semaphore.make(1), (lock) => ({ lock, recent: new Set() })),
);

export const newStoryMapId = IdGenerator.use(({ nextId }) =>
  Effect.map(nextId, (uuid) => {
    const id = recordId(storyMapType.type, uuid);
    if (!isStoryMapId(id)) throw new Error("The host generated an invalid Story Map ID");
    return id;
  }),
);

function relevantSource({ path, frontmatter }: Note) {
  return (
    isStoryMapId(frontmatter.id) ||
    (typeof frontmatter.schema === "string" &&
      frontmatter.schema.startsWith("product-engineering.story-map/")) ||
    /(?:^|\/)Story Maps\//.test(path)
  );
}

function freshMaps(store: NoteStore["Service"], recent: Set<string>) {
  return Effect.gen(function* () {
    const paths = new Set((yield* store.sources).filter(relevantSource).map(({ path }) => path));
    // A new note reaches Obsidian's metadata cache asynchronously.
    for (const path of recent) {
      if (paths.has(path)) recent.delete(path);
      else paths.add(path);
    }
    return yield* Effect.forEach(
      paths,
      (path) =>
        store.readFresh(path).pipe(
          Effect.catchTag(["NoteNotFoundError", "NoteUnreadableError"], () => {
            recent.delete(path);
            return Effect.succeed(undefined);
          }),
        ),
      { concurrency: 4 },
    );
  });
}

function nextDisplayId(projectId: ProjectId, notes: readonly (Note | undefined)[]) {
  const last = notes.reduce((max, note) => {
    const fields = note?.frontmatter;
    if (fields?.project_id !== projectId) return max;
    const raw = fields.display_id;
    if (typeof raw !== "string" || !/^SM-[0-9]{2,}$/.test(raw)) return max;
    const sequence = Number(raw.slice(3));
    return Number.isSafeInteger(sequence + 1) ? Math.max(max, sequence) : max;
  }, 0);
  return `SM-${String(last + 1).padStart(2, "0")}`;
}

function previousCreation(
  notes: readonly (Note | undefined)[],
  { id, projectId, prdId }: StoryMapCreation,
  draft: StoryMapDraft,
) {
  const matches = notes.filter((note) => note?.frontmatter.id === id);
  if (!matches.length) return Effect.succeed(undefined);
  const note = matches.length === 1 ? matches[0] : undefined;
  const record = note && decodeStoryMap(note);
  if (
    note &&
    record?.projectId === projectId &&
    record.prdId === prdId &&
    storyMapFields.every((field) => record[field] === draft[field])
  )
    return Effect.succeed(note);
  return Effect.fail(new StoryMapError({ reason: "identity" }));
}

function writeNewMap(
  project: ProjectSettings,
  { id, prdId, sourcePath }: StoryMapCreation,
  draft: StoryMapDraft,
  displayId: string,
) {
  return Effect.gen(function* () {
    const store = yield* NoteStore;
    const foundation = prdId
      ? yield* storyMapFoundations(project.id, prdId, sourcePath)
      : undefined;
    return yield* store.create({
      folder: recordFolder(project.folder, storyMapType),
      name: `${displayId} ${id}`,
      frontmatter: recordFrontmatter(storyMapType, id, {
        ...draft,
        project_id: project.id,
        display_id: displayId,
        ...(foundation && {
          prd_id: foundation.prd.id,
          job_ids: foundation.jobs.map((job) => job.id),
        }),
        activities: [],
        steps: [],
        slices: [],
        cards: [],
        card_links: [],
      }),
    });
  });
}

export function createStoryMap(request: StoryMapCreation, input: StoryMapDraft) {
  const { projectId, id } = request;
  const draft = {
    title: input.title.trim(),
    persona: input.persona.trim(),
    goal: input.goal.trim(),
  };
  return StoryMapWrites.use(({ lock, recent }) =>
    lock.withPermit(
      Effect.uninterruptible(
        Effect.gen(function* () {
          if (!isStoryMapId(id)) return yield* new StoryMapError({ reason: "identity" });
          if (storyMapFields.some((field) => storyMapFieldInvalid(field, draft[field]))) {
            return yield* new StoryMapError({ reason: "fields" });
          }
          const project = yield* readFreshProject(projectId);
          if (!project) return yield* new StoryMapError({ reason: "scope" });
          const store = yield* NoteStore;
          const notes = yield* freshMaps(store, recent);
          const prior = yield* previousCreation(notes, request, draft);
          if (prior) return prior;
          const created = yield* writeNewMap(
            project,
            request,
            draft,
            nextDisplayId(projectId, notes),
          );
          recent.add(created.path);
          return created;
        }),
      ),
    ),
  );
}
