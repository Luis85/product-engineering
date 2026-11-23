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
    ]),
  },
) {}
