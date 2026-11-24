import { storyMapType } from "../../domain/story-maps";
import { defineModule } from "../module";
import { storyMapWritesLayer } from "./create";
import type { StoryMapError } from "./errors";
import { de } from "./i18n/de";
import { en } from "./i18n/en";
import { projectStoryMapsSchema } from "./routes";

export const storyMapsModule = defineModule({
  name: "story-maps",
  catalog: { en, de },
  routes: [projectStoryMapsSchema],
  noteTypes: [storyMapType],
  services: storyMapWritesLayer,
  errors: {
    tags: { StoryMapError: true },
    describe: (error: StoryMapError, text: typeof en) => ({
      severity: "error",
      title: text.errors[error.reason],
      detail: "",
    }),
  },
});
