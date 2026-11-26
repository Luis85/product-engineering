import { Schema } from "effect";

export class DomainModelError extends Schema.TaggedError<DomainModelError>()("DomainModelError", {
  reason: Schema.Literals(["entity", "edge", "duplicate", "changed", "scope", "attributes"]),
}) {}
