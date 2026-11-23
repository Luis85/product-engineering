import { Schema } from "effect";
import { defineNoteType, lineOfText, list, required, text } from "../notes";
import type { NoteValues } from "../notes";
import { projectIdSchema, projectMemberIdSchema } from "../projects";
import { entityFields } from "./entity";
import { knowledgeId } from "./identity";

export const actorTypes = ["human", "system"] as const;
export const approvals = ["draft", "in-review", "approved", "changes-requested"] as const;
export const TITLE_MAX_LENGTH = 160;

export type ActorType = (typeof actorTypes)[number];

export const knowledgeType = defineNoteType({
  type: "knowledge",
  version: 1,
  fields: {
    project_id: required(text({ schema: projectIdSchema, issue: "project.invalid" })),
    title: required(text({ schema: lineOfText(TITLE_MAX_LENGTH), issue: "title.invalid" })),
    kind: required(text({ schema: lineOfText(80), issue: "kind.invalid" })),
    display_id: required(text({ schema: lineOfText(32), issue: "display-id.invalid" })),
    approval: text({ schema: Schema.Literals(approvals), issue: "approval.invalid" }),
    owner_id: text({ schema: projectMemberIdSchema, issue: "owner.invalid" }),
    actor_type: text({ schema: Schema.Literals(actorTypes), issue: "actor.invalid" }),
    requirement_id: text({ schema: lineOfText(32), issue: "requirement-id.invalid" }),
    vision_id: text({ schema: knowledgeId, issue: "vision.invalid" }),
    job_ids: list({ schema: Schema.Array(knowledgeId), issue: "job.invalid" }),
    deliverable_id: text({ schema: lineOfText(160), issue: "deliverable.invalid" }),
    references: list({ schema: Schema.Array(lineOfText(1024)), issue: "reference.invalid" }),
    ...entityFields,
  },
  migrations: {},
});

export type KnowledgeValues = NoteValues<typeof knowledgeType.fields>;
