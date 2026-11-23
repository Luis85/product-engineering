import { projectType } from "../../domain/projects";
import { defineModule } from "../module";
import type { PluginCommand } from "../module";
import { de } from "./i18n/de";
import { en } from "./i18n/en";
import type { InvalidProjectError, ProjectStorageError } from "./errors";
import type { ProjectsCatalog } from "./i18n/catalog";
import { projectWritesLayer } from "./registration";
import {
  projectAdministrationSchema,
  projectChooserRoute,
  projectOverviewSchema,
  projectRecordSchema,
} from "./routes";

const commands: readonly PluginCommand<{ readonly projects: ProjectsCatalog }, never, never>[] = [
  {
    id: "search-project",
    name: ({ projects }) => projects.search.open,
    action: { _tag: "open", signal: "project-search" },
  },
];

export const projectsModule = defineModule({
  name: "projects",
  catalog: { en, de },
  errors: {
    tags: { InvalidProjectError: true, ProjectStorageError: true },
    describe: (error: InvalidProjectError | ProjectStorageError, text: ProjectsCatalog) => ({
      severity: "error",
      title: error._tag === "InvalidProjectError" ? text.errors.invalid : text.errors[error.reason],
      detail:
        error._tag === "InvalidProjectError"
          ? error.fields.map((field) => text.errors[field]).join(" ")
          : "",
    }),
  },
  routes: [
    projectChooserRoute,
    projectOverviewSchema,
    projectAdministrationSchema,
    projectRecordSchema,
  ],
  noteTypes: [projectType],
  services: projectWritesLayer,
  commands,
});
