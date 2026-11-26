import { Schema } from "effect";
import { lineOfText } from "../../domain/notes";
import { storyMapIdSchema } from "../../domain/story-maps";
import type { StoryMapId } from "../../domain/story-maps";
import { projectIdSchema } from "../projects";
import type { ProjectId } from "../projects";

export const PROJECT_STORY_MAPS = "project-story-maps";
export const projectStoryMapsSchema = Schema.Struct({
  name: Schema.Literal(PROJECT_STORY_MAPS),
  projectId: projectIdSchema,
  mapId: Schema.optionalKey(storyMapIdSchema),
  cardId: Schema.optionalKey(lineOfText(160).check(Schema.isMinLength(1))),
  sliceId: Schema.optionalKey(lineOfText(160).check(Schema.isMinLength(1))),
});

export function storyMapsRoute(
  projectId: ProjectId,
  mapId?: StoryMapId,
  cardId?: string,
): typeof projectStoryMapsSchema.Type {
  return {
    name: PROJECT_STORY_MAPS,
    projectId,
    ...(mapId && { mapId, ...(cardId && { cardId }) }),
  };
}

export function storyMapSliceRoute(
  projectId: ProjectId,
  mapId: StoryMapId,
  sliceId: string,
): typeof projectStoryMapsSchema.Type {
  return { ...storyMapsRoute(projectId, mapId), sliceId };
}
