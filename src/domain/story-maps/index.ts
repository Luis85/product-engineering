import { Result, Schema } from "effect";
import { knowledgeId } from "../knowledge";
import {
  defineNoteType,
  lineOfText,
  list,
  recordIdIssue,
  recordList,
  required,
  text,
} from "../notes";
import { projectIdSchema } from "../projects";
import { extractStoryMapFoundationDraft } from "./foundations";
export { isStoryMapCard, isStoryMapCardLink } from "./cards";
export type { StoryMapCard, StoryMapCardLink } from "./cards";

export const storyMapIdSchema = Schema.TemplateLiteral(["story-map-", Schema.String]).check(
  Schema.makeFilter((value) => recordIdIssue("story-map", value) === undefined),
);
export const isStoryMapId = Schema.is(storyMapIdSchema);
export type StoryMapId = typeof storyMapIdSchema.Type;

const nonBlank = Schema.makeFilter((value: string) => Boolean(value.trim()));
const named = (length: number) => lineOfText(length).check(nonBlank);
export const storyMapFields = ["title", "persona", "goal"] as const;
export const storyMapLimits = { title: 160, persona: 100, goal: 300 } as const;
export type StoryMapField = (typeof storyMapFields)[number];
export type StoryMapDraft = Readonly<Record<StoryMapField, string>>;

export const storyMapType = defineNoteType({
  type: "story-map",
  version: 1,
  folder: "Story Maps",
  fields: {
    project_id: required(text({ schema: projectIdSchema, issue: "project.invalid" })),
    display_id: required(
      text({
        schema: lineOfText(32).check(Schema.isPattern(/^SM-[0-9]{2,}$/)),
        issue: "id.invalid",
      }),
    ),
    title: required(text({ schema: named(storyMapLimits.title), issue: "title.invalid" })),
    persona: required(text({ schema: named(storyMapLimits.persona), issue: "persona.invalid" })),
    goal: required(
      text({
        schema: Schema.String.check(nonBlank, Schema.isMaxLength(storyMapLimits.goal)),
        issue: "goal.invalid",
      }),
    ),
    prd_id: text({ schema: knowledgeId, issue: "knowledge.invalid" }),
    job_ids: list({ schema: Schema.Array(knowledgeId), issue: "knowledge.invalid" }),
    activities: required(recordList()),
    steps: required(recordList()),
    slices: required(recordList()),
    cards: required(recordList()),
    card_links: recordList(),
  },
  migrations: {},
});

export function storyMapFieldInvalid(field: StoryMapField, value: string) {
  return Result.isFailure(storyMapType.fields[field].check(value.trim()));
}

export function storyMapFoundationDraft(title: string, prd: string, vision?: string, job?: string) {
  return extractStoryMapFoundationDraft(title, prd, vision, job, storyMapLimits);
}
