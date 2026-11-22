import { Schema } from "effect";
import { ReadOnlyReason, SettingsIssue } from "../../domain/shell";

export class StorageError extends Schema.TaggedError<StorageError>()("StorageError", {
  cause: Schema.optional(Schema.Unknown),
}) {}

export class ReadOnlySettingsError extends Schema.TaggedError<ReadOnlySettingsError>()(
  "ReadOnlySettingsError",
  { reason: ReadOnlyReason },
) {}

export class InvalidSettingsError extends Schema.TaggedError<InvalidSettingsError>()(
  "InvalidSettingsError",
  { issues: Schema.Array(SettingsIssue) },
) {}

export class VaultReadError extends Schema.TaggedError<VaultReadError>()("VaultReadError", {
  cause: Schema.optional(Schema.Unknown),
}) {}

export class ClipboardError extends Schema.TaggedError<ClipboardError>()("ClipboardError", {
  cause: Schema.optional(Schema.Unknown),
}) {}

export type ShellError =
  StorageError | ReadOnlySettingsError | InvalidSettingsError | VaultReadError | ClipboardError;
