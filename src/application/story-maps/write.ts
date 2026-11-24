import { Context, Effect, Layer, Result, Semaphore } from "effect";
import { storyMapType } from "../../domain/story-maps";
import type { NoteValues } from "../../domain/notes";
import { NoteStore, editChange } from "../notes";
import type { NoteEditConflictError, NoteWriteRefusedError } from "../notes";
import { readFreshProject } from "../projects";
import { StoryMapError } from "./errors";
import { decodeStoryMap } from "./records";
import type { StoryMapRecord } from "./records";

export class StoryMapWrites extends Context.Service<
  StoryMapWrites,
  { readonly lock: Semaphore.Semaphore; readonly recent: Set<string> }
>()("product-engineering/application/StoryMapWrites") {}

export const storyMapWritesLayer = Layer.effect(
  StoryMapWrites,
  Effect.map(Semaphore.make(1), (lock) => ({ lock, recent: new Set() })),
);

type WritableField =
  | "title"
  | "persona"
  | "goal"
  | "prd_id"
  | "job_ids"
  | "references"
  | "activities"
  | "steps"
  | "slices"
  | "cards"
  | "card_links"
  | "story_work";
type StoryMapFields = {
  readonly [Key in WritableField]?: NoteValues<typeof storyMapType.fields>[Key] | undefined;
};

export function withStoryMapWrite<A, E, R>(operation: Effect.Effect<A, E, R>) {
  return StoryMapWrites.use(({ lock }) => lock.withPermit(Effect.uninterruptible(operation)));
}

export function freshStoryMap(base: StoryMapRecord) {
  return Effect.gen(function* () {
    if (!(yield* readFreshProject(base.projectId)))
      return yield* new StoryMapError({ reason: "scope" });
    const store = yield* NoteStore;
    const paths = (yield* store.sources).filter(({ frontmatter }) => frontmatter.id === base.id);
    if (paths.length > 1) return yield* new StoryMapError({ reason: "identity" });
    const current = decodeStoryMap(yield* store.readFresh(paths[0]?.path ?? base.path));
    if (current?.id !== base.id || current.projectId !== base.projectId)
      return yield* new StoryMapError({ reason: "identity" });
    return current;
  });
}

export function writeStoryMap(
  base: StoryMapRecord,
  current: StoryMapRecord,
  fields: StoryMapFields,
  guard?: (actual: StoryMapRecord) => boolean,
) {
  const merge = editChange(storyMapType, base.frontmatter, { ...base.frontmatter, ...fields });
  return NoteStore.use(({ update }) =>
    update<StoryMapError | NoteEditConflictError | NoteWriteRefusedError>(
      current.path,
      (frontmatter) => {
        const actual = decodeStoryMap({ path: current.path, frontmatter });
        if (actual?.id !== base.id || actual.projectId !== base.projectId)
          return Result.fail(new StoryMapError({ reason: "identity" }));
        if (guard && !guard(actual)) return Result.fail(new StoryMapError({ reason: "journey" }));
        return merge(frontmatter);
      },
    ),
  );
}
