import { Schema } from "effect";

export class ProjectStorageError extends Schema.TaggedError<ProjectStorageError>()(
  "ProjectStorageError",
  { reason: Schema.Literals(["folder", "base", "identity"]) },
) {}

export const projectDetailFields = [
  "name",
  "description",
  "vault_folder",
  "backlog_base",
  "repository",
  "branch",
] as const;

export class InvalidProjectError extends Schema.TaggedError<InvalidProjectError>()(
  "InvalidProjectError",
  { fields: Schema.Array(Schema.Literals(projectDetailFields)) },
) {}

export class ProjectMemberError extends Schema.TaggedError<ProjectMemberError>()(
  "ProjectMemberError",
  {
    reason: Schema.Literals(["name", "role", "duplicate", "unavailable"]),
  },
) {}

export class ProjectCriterionError extends Schema.TaggedError<ProjectCriterionError>()(
  "ProjectCriterionError",
  {
    reason: Schema.Literals(["title", "type", "unavailable", "conflict"]),
  },
) {}

export class ProjectIntegrationError extends Schema.TaggedError<ProjectIntegrationError>()(
  "ProjectIntegrationError",
  {
    reason: Schema.Literals(["data_class", "settings"]),
  },
) {}
