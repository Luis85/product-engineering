import { projectType } from "../../domain/projects";
import { defineModule } from "../module";
import type { PluginCommand } from "../module";
import { de } from "./i18n/de";
import { en } from "./i18n/en";
import type {
  InvalidProjectError,
  ProjectCriterionError,
  ProjectIntegrationError,
  ProjectMemberError,
  ProjectStorageError,
} from "./errors";
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
    tags: {
      InvalidProjectError: true,
      ProjectCriterionError: true,
      ProjectIntegrationError: true,
      ProjectMemberError: true,
      ProjectStorageError: true,
    },
    describe: (
      error:
        | InvalidProjectError
        | ProjectCriterionError
        | ProjectIntegrationError
        | ProjectMemberError
        | ProjectStorageError,
      text: ProjectsCatalog,
    ) => {
      const title =
        error._tag === "InvalidProjectError"
          ? text.errors.invalid
          : error._tag === "ProjectMemberError"
            ? text.team.errors[error.reason]
            : error._tag === "ProjectCriterionError"
              ? text.definitions.errors[error.reason]
              : error._tag === "ProjectIntegrationError"
                ? text.integrations.errors[error.reason]
                : text.errors[error.reason];
      const detail =
        error._tag === "InvalidProjectError"
          ? error.fields.map((field) => text.errors[field]).join(" ")
          : "";
      return { severity: "error", title, detail };
    },
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
