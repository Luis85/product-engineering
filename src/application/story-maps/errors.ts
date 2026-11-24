import { Schema } from "effect";

export class StoryMapError extends Schema.TaggedError<StoryMapError>()("StoryMapError", {
  reason: Schema.Literals(["scope", "identity", "fields", "source", "target", "journey", "work"]),
}) {}
