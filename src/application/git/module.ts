import { defineModule } from "../module";
import type { ArtifactGitError } from "./model";
import { de } from "./i18n/de";
import { en } from "./i18n/en";

export const artifactGitModule = defineModule({
  name: "git",
  catalog: { de, en },
  errors: {
    tags: { ArtifactGitError: true },
    describe: ({ reason }: ArtifactGitError, text: typeof en) => ({
      severity: "error",
      title: text.errors[reason],
      detail: "",
    }),
  },
});
