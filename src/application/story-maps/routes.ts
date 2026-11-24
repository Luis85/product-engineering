import { Schema } from "effect";
import { storyMapIdSchema } from "../../domain/story-maps";
import type { StoryMapId } from "../../domain/story-maps";
import { projectIdSchema } from "../projects";
import type { ProjectId } from "../projects";

export const PROJECT_STORY_MAPS = "project-story-maps";
export const projectStoryMapsSchema = Schema.Struct({
  name: Schema.Literal(PROJECT_STORY_MAPS),
  projectId: projectIdSchema,
  mapId: Schema.optionalKey(storyMapIdSchema),
});

export function storyMapsRoute(
  projectId: ProjectId,
  mapId?: StoryMapId,
): typeof projectStoryMapsSchema.Type {
  return { name: PROJECT_STORY_MAPS, projectId, ...(mapId && { mapId }) };
}
