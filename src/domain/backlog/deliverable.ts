import { Result, Schema } from "effect";
import { knowledgeId } from "../knowledge";
import { date, defineNoteType, lineOfText, recordIdIssue, required, text } from "../notes";
import type { NoteValues } from "../notes";
import { projectIdSchema, projectMemberIdSchema } from "../projects";

export const deliverableStatuses = ["planned", "in-progress", "in-review", "done"] as const;
export const deliverableIdSchema = Schema.TemplateLiteral(["deliverable-", Schema.String]).check(
  Schema.makeFilter((value) => recordIdIssue("deliverable", value) === undefined),
);
export const isDeliverableId = Schema.is(deliverableIdSchema);
export type DeliverableId = typeof deliverableIdSchema.Type;
export type DeliverableStatus = (typeof deliverableStatuses)[number];

const title = lineOfText(150).check(Schema.makeFilter((value) => Boolean(value.trim())));
const nonBlank = Schema.String.check(Schema.makeFilter((value) => Boolean(value.trim())));

export const deliverableType = defineNoteType({
  type: "deliverable",
  version: 1,
  fields: {
    project_id: required(text({ schema: projectIdSchema, issue: "project.invalid" })),
    display_id: required(
      text({
        schema: lineOfText(32).check(Schema.isPattern(/^DEL-[0-9]{2,}$/)),
        issue: "id.invalid",
      }),
    ),
    title: required(text({ schema: title, issue: "title.invalid" })),
    outcome: required(text({ schema: nonBlank, issue: "outcome.invalid" })),
    status: required(
      text({ schema: Schema.Literals(deliverableStatuses), issue: "status.invalid" }),
    ),
    owner_id: text({ schema: projectMemberIdSchema, issue: "owner.invalid" }),
    due: date(),
    template: text({
      schema: lineOfText(64).check(Schema.isMinLength(1)),
      issue: "template.invalid",
    }),
    knowledge_id: text({ schema: knowledgeId, issue: "knowledge.invalid" }),
    pending_knowledge_id: text({ schema: knowledgeId, issue: "knowledge.invalid" }),
  },
  migrations: {},
});

export type DeliverableValues = NoteValues<typeof deliverableType.fields>;
export type DeliverableDraft = Omit<
  DeliverableValues,
  "display_id" | "project_id" | "pending_knowledge_id"
>;

export function deliverableDraftIssue(draft: DeliverableDraft) {
  const keys = [
    "title",
    "outcome",
    "status",
    "owner_id",
    "due",
    "template",
    "knowledge_id",
  ] as const;
  return keys.find((key) => Result.isFailure(deliverableType.fields[key].check(draft[key])));
}
