import { Schema } from "effect";

export class FeatureRequestError extends Schema.TaggedError<FeatureRequestError>()(
  "FeatureRequestError",
  { reason: Schema.Literals(["project", "identity", "pbi", "title", "scope"]) },
) {}
