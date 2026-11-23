import { Schema } from "effect";

export class KnowledgeCreateError extends Schema.TaggedError<KnowledgeCreateError>()(
  "KnowledgeCreateError",
  {
    reason: Schema.Literals([
      "title",
      "actor_type",
      "owner_id",
      "project",
      "template",
      "identity",
      "vision_id",
      "job_ids",
      "origin",
      "attributes",
    ]),
  },
) {}

export class KnowledgeEditError extends Schema.TaggedError<KnowledgeEditError>()(
  "KnowledgeEditError",
  { reason: Schema.Literals(["title", "approval", "owner_id", "references", "domain_attributes"]) },
) {}
