import { Schema } from "effect";
import { backlogIdSchema } from "../backlog";
import { lineOfText } from "../notes";
import { projectIdSchema } from "../projects";

const nodeId = lineOfText(160).check(Schema.isMinLength(1));
const card = Schema.Struct({
  id: nodeId,
  stepId: nodeId,
  sliceId: Schema.optionalKey(nodeId),
  title: Schema.String.check(Schema.isMinLength(1)),
  description: Schema.optionalKey(Schema.String),
});

// Flat note records keep cards and their links writable through NoteStore.
const cardLink = Schema.Struct({
  cardId: nodeId,
  kind: Schema.Literal("item"),
  projectId: projectIdSchema,
  recordId: backlogIdSchema,
});

export type StoryMapCard = typeof card.Type;
export type StoryMapCardLink = typeof cardLink.Type;
export const isStoryMapCard = Schema.is(card);
export const isStoryMapCardLink = Schema.is(cardLink);
