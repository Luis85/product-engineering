import { Schema } from "effect";

export class PrototypeError extends Schema.TaggedError<PrototypeError>()("PrototypeError", {
  reason: Schema.Literals([
    "project",
    "identity",
    "title",
    "description",
    "source",
    "design",
    "designDraft",
    "outputInvalid",
    "outputTooLarge",
    "outputChanged",
    "generationCancelled",
    "generationFailed",
    "generationReplacement",
  ]),
}) {}
