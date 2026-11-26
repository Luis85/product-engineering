import type { StoryMapActivity } from "../../domain/story-maps";

export type StoryMapColumn = {
  readonly key: string;
  readonly id: string | undefined;
  readonly title: string;
  readonly activity: StoryMapActivity;
};
