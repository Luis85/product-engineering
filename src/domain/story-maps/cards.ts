import { Schema } from "effect";
import { backlogIdSchema } from "../backlog";
import { lineOfText, recordIdIssue } from "../notes";
import { projectIdSchema } from "../projects";

const nodeId = lineOfText(160).check(Schema.isMinLength(1));
const named = Schema.Struct({ id: nodeId, title: Schema.String.check(Schema.isMinLength(1)) });
const step = Schema.Struct({ ...named.fields, activityId: nodeId });
const slice = Schema.Struct({ ...named.fields, outcome: Schema.optionalKey(Schema.String) });
const card = Schema.Struct({
  ...named.fields,
  stepId: nodeId,
  sliceId: Schema.optionalKey(nodeId),
  description: Schema.optionalKey(Schema.String),
});

// Flat note records keep cards and their links writable through NoteStore.
const cardLink = Schema.Struct({
  cardId: nodeId,
  kind: Schema.Literal("item"),
  projectId: projectIdSchema,
  recordId: backlogIdSchema,
});

const storyWork = Schema.Struct({
  cardId: nodeId,
  id: backlogIdSchema,
  recordId: Schema.String.check(
    Schema.makeFilter((value) => recordIdIssue("backlog", value) === undefined),
  ),
  kind: Schema.Literals(["TASK", "ISS", "Q", "BUG"]),
  title: named.fields.title,
  body: Schema.String,
  state: Schema.String,
  priority: Schema.String,
  owner: Schema.String,
});

export type StoryMapCard = typeof card.Type;
export type StoryMapCardLink = typeof cardLink.Type;
export type StoryMapActivity = typeof named.Type;
export type StoryMapStep = typeof step.Type;
export type StoryMapSlice = typeof slice.Type;
export type StoryMapWork = typeof storyWork.Type;
export const isStoryMapActivity = Schema.is(named);
export const isStoryMapStep = Schema.is(step);
export const isStoryMapSlice = Schema.is(slice);
export const isStoryMapCard = Schema.is(card);
export const isStoryMapCardLink = Schema.is(cardLink);
export const isStoryMapWork = Schema.is(storyWork);
