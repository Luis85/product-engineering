import { PROJECT_STORY_MAPS } from "../../application/story-maps";
import type { ModuleScreens } from "../shell";

export const storyMapsScreens = {
  screens: {
    [PROJECT_STORY_MAPS]: () => import("./StoryMapsScreen.vue").then((module) => module.default),
  },
  sections: {},
} satisfies ModuleScreens<"story-maps">;
