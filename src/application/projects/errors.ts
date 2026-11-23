import { Schema } from "effect";

export class ProjectStorageError extends Schema.TaggedError<ProjectStorageError>()(
  "ProjectStorageError",
  { reason: Schema.Literals(["folder", "base", "identity"]) },
) {}

export class InvalidProjectError extends Schema.TaggedError<InvalidProjectError>()(
  "InvalidProjectError",
  { fields: Schema.Array(Schema.Literals(["name", "description", "repository"])) },
) {}
